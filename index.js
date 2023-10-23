/* 
Last update : 20231023

TODO
---------

- Revoir la fonction openChestInventory ()
     - Utiliser p-map au lieu de Promise.all ? 
- Revoir la fonction getChestStatus ()
     - Utiliser retry() pour prévenir les indispo temporaire de la réponsé API
	 - Utiliser axios() au lieu de fetch() ? 
- Supprimer listVisitedRoomID et utiliser listVisitedRooms[x].id à la place

---------


*/ 

import Bottleneck from "bottleneck";
import axios from "axios";
import retry from 'async-retry'
import pMap from 'p-map';

const limiter = new Bottleneck({ maxConcurrent: 1000, minTime: 0 });
const limiter2 = new Bottleneck({ maxConcurrent: 5000, minTime: 0 }); //TODO Utile ?
const listVisitedRoomID = [] //TODO  A merger avec listVisitedRooms
const listVisitedRooms = []
const listChests = []
const CHEST_EMPTY_STATUS = "This chest is empty :/ Try another one!"
const castleURL = "https://infinite-castles.azurewebsites.net/"
const castleFirstRoom = "castles/1/rooms/entry"
let nbChest=0; //DEBUG / TODO : A supprimer

startExploration()

async function startExploration() {
  await exploreCastleByLevel([castleFirstRoom], 0)
  await openChestInventory(listChests)
  displayChestData(true)
}

async function getChestStatus(pChest) {
  nbChest++
  console.log(nbChest)
  return retry(async bail => {
    try {
      let response = await fetch(castleURL + pChest.id);
      if (!response.ok) throw new Error('Network response KO :  ' + response.statusText);
      let chestData = await response.json();
      pChest.status = chestData.status
    } catch (error) {
      console.log(JSON.stringify(response))
      bail(error)  // This will stop the retry loop if the error occurs again
    }
  }, {
    retries: 5,
  })
}

async function openChestInventory(pListChest) {
  await pMap(pListChest, async chest => {
    await limiter.schedule(() => getChestStatus(chest));
  }, {concurrency: 500}); 
}

function displayChestData(displaySummary) {
  let notEmptyChestCount=0;
  console.log("chestID;chestStatus;roomID")
  for (let chestID in listChests) {
    if (listChests[chestID].status != CHEST_EMPTY_STATUS)
    {
      console.log(listChests[chestID].id + ";" + listChests[chestID].status + ";" + listChests[chestID].room)
      notEmptyChestCount++;
    }
  }
 if(displaySummary)  
 {
   console.log("End of Exploration ! ")
   console.log("Nbre Rooms : " + listVisitedRooms.length)
   console.log("Nbre Chests : " + listChests.length + "(" + notEmptyChestCount + " not empty)")
 }
}

async function exploreCastleByLevel(pListRoomsIDs, level) {
  if(pListRoomsIDs.length==0)return
  let nextLevelListRoomsID = [] //Liste des rooms suivantes
  let listPromise = [] // Liste de stockage des Promise
  for (let roomID in pListRoomsIDs) {
    if (listVisitedRoomID.includes(pListRoomsIDs[roomID]) == false) { //Petit controle pour éviter de tourner en rond, mais apparament, le cas ne se présente pas 
	//TODO refacto pour ne pas avoir une variable dédié (listVisitedRoomID). utilisation de .some() ? 
      const nextRoomPromise = limiter.schedule(() => openRoom(pListRoomsIDs[roomID]))
      listPromise.push(nextRoomPromise) // Ajout dans la liste des promise en cours
    }
  }
  await Promise.all(listPromise) 
    .then((promisedListRooms) => {
      for (let id in promisedListRooms) {
        let myCurrentRoom = promisedListRooms[id]
        listVisitedRooms.push(myCurrentRoom) // Utilisé juste pour les stats de fin 
        for (let idConnectedRooms in myCurrentRoom.connectedRoomsID) { nextLevelListRoomsID.push(myCurrentRoom.connectedRoomsID[idConnectedRooms]) }
        listVisitedRoomID.push(myCurrentRoom.id);

        for (let chestID in myCurrentRoom.chests) {
          let currentChest = new Chest(myCurrentRoom.chests[chestID], null, myCurrentRoom.id) //Creation du chest, sans connaitre son status pour le moment. On ouvrira plus tard, une fois l'exploration terminée // TODO Optimisable en ouvrant directement ? Surcharge API aux premiers essai :/ 
          listChests.push(currentChest)
        }
      }
    })
  return exploreCastleByLevel(nextLevelListRoomsID, level + 1)
}

async function openRoom(pRoomID) {
  try {
    const response = await fetch(castleURL + pRoomID);
    const roomData = await response.json();
    const currentRoom = new Room(roomData.id, roomData.rooms, roomData.chests);
    return currentRoom;
  }
  catch (error) {console.log("[Error on openRoom] : pRoomID="  + pRoomID + " Error : " + error)}
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
