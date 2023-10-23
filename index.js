import Bottleneck from "bottleneck";

const limiter = new Bottleneck({ maxConcurrent: 1000, minTime: 0 });
const limiter2 = new Bottleneck({ maxConcurrent: 5000, minTime: 0 }); //TODO Utile ?
const visitedRoomID = [] //TODO  A merger avec listVisitedRooms
const listVisitedRooms = []
const listChests = []
const CHEST_EMPTY_STATUS = "This chest is empty :/ Try another one!"
const castleURL = "https://infinite-castles.azurewebsites.net/"
const castleFirstRoom = "castles/1/rooms/entry"
let notEmptyChestCount = 0 //TODO Liste de not_empty_chest ? ou juste DEBUG et donc Supprimer

function wait(milliseconds){
  return new Promise(resolve => {setTimeout(resolve, milliseconds);});
}

startExploration()

async function startExploration() {
  await exploreCastleByLevel([castleFirstRoom], 0)
  await openChestInventory(listChests)
  exportDataChest()
}

function exportDataChest() {
  console.log("chestID;chestStatus;roomID")
  for (let chestID in listChests) {
    if (listChests[chestID].status != CHEST_EMPTY_STATUS)
    {
      console.log(listChests[chestID].id + ";" + listChests[chestID].status + ";" + listChests[chestID].room)
      notEmptyChestCount++;
    }
  }

 if (DEBUG_level > 0) console.log("End of Exploration ! ")
 if (DEBUG_level > 0) console.log("Nbre Rooms : " + listVisitedRooms.length)
 if (DEBUG_level > 0) console.log("Nbre Chests : " + listChests.length + "(" + notEmptyChestCount + " not empty)")
}

async function exploreCastleByLevel(pListRoomsIDs, level) {
  if(pListRoomsIDs.length==0)return
  let nextLevelListRoomsID = [] //Liste des rooms suivantes
  let listPromise = [] // Liste de stockage des Promise
  for (let roomID in pListRoomsIDs) {
    if (visitedRoomID.includes(pListRoomsIDs[roomID]) == false) { //Petit controle pour éviter de tourner en rond, mais apparament, le cas ne se présente pas TODO refacto pour ne pas avoir une variable dédié (visitedRoomID) ? utilisation de.some() ? 
      const nextRoomPromise = limiter.schedule(() => openRoom(pListRoomsIDs[roomID]))
      listPromise.push(nextRoomPromise) // Ajout dans la liste des promise en cours
    }
  }
  await Promise.all(listPromise) // Attente de l'éxécution de toutes les requests //TODO  : await utile? 
    .then((promisedListRooms) => {
      for (let id in promisedListRooms) {
        let myCurrentRoom = promisedListRooms[id]
        listVisitedRooms.push(myCurrentRoom) // TODO Utile  ? (juste pour les stats de fin ? )
        for (let idConnectedRooms in myCurrentRoom.connectedRoomsID) { nextLevelListRoomsID.push(myCurrentRoom.connectedRoomsID[idConnectedRooms]) }
        visitedRoomID.push(myCurrentRoom.id);

        for (let chestID in myCurrentRoom.chests) {
          let currentChest = new Chest(myCurrentRoom.chests[chestID], "indéterminé", myCurrentRoom.id) //Creation du chest, sans connaitre son status pour le moment. On ouvrira plus tard, une fois l'exploration terminée // TODO Optimisable en ouvrant directement ? 
          listChests.push(currentChest) //TODO : factoriser avec la précédente [-1]
        }
      }
    })
  return exploreCastleByLevel(nextLevelListRoomsID, level + 1)
}

async function openChestInventory(pListChest) { //On ouvre les coffres TODO : voir si optim possible
  const listPromiseChestStatus = [] // Liste de stockage des Promise
  for (let chestID in pListChest) {
    const currentChestPromise = limiter2.schedule(() => getChestStatus(pListChest[chestID]))
    listPromiseChestStatus.push(currentChestPromise)
  }
  await Promise.all(listPromiseChestStatus)
}

async function openRoom(pRoomID) {
  try {
    const currentRoomURL = castleURL + pRoomID;
    const response = await fetch(currentRoomURL); //TODO : Factoriser avec précédente [-1]
    const roomData = await response.json();
    const currentRoom = new Room(roomData.id, roomData.rooms, roomData.chests);
    return currentRoom; //TODO Factoriser avec précédente [-1]
  }
  catch (error) {console.log("[Error on openRoom] : pRoomID="  + pRoomID + "Error : " + error)}
}

async function getChestStatus(pChest) {
  try {
    const chestURL = castleURL + pChest.id;
    let response = await fetch(chestURL); // TODO : Factoriser avec précédente [-1]
    let chestData = await response.json();
    while(!chestData.status) 
      {
        await wait(1000);
         response = await fetch(chestURL);
         chestData = await response.json();
      }
    pChest.status = chestData.status
    return pChest
  }
  catch (error) {}
}

// Declaration Objets
class Chest {
  constructor(id, status, roomID) {
    this.id = id;
    this.status = status;
    this.room = roomID;
  }
}

class Room {
  constructor(id, connectedRooms, chests) {
    this.id = id;
    this.connectedRoomsID = connectedRooms;
    this.chests = chests;
  }
}