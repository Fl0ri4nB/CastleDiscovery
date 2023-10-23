/* 
Last update : 20231023

TODO
---------
- Utiliser axios() au lieu de fetch() ? 
---------

*/ 

import Bottleneck from "bottleneck";
import axios from "axios";
import retry from 'async-retry'
import pMap from 'p-map';

const limiter = new Bottleneck({ maxConcurrent: 1000, minTime: 0 });
const listVisitedRoomID = [] //TODO  A merger avec listVisitedRooms
const listVisitedRooms = []
const listChests = []
const CHEST_EMPTY_STATUS = "This chest is empty :/ Try another one!"
const castleURL = "https://infinite-castles.azurewebsites.net/"
const castleFirstRoom = "castles/1/rooms/entry"

startExploration()

async function startExploration() {
  await exploreCastleByLevel([castleFirstRoom], 0)
  await openChestInventory(listChests)
  displayChestData(true)
}

async function getChestStatus(pChest) {

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
  
  await pMap(pListRoomsIDs, async roomID => {
    console.log ("[" + listVisitedRooms.length + "]")
     if (listVisitedRoomID.includes(roomID) == false) 
     {let myCurrentRoom = await limiter.schedule(() => openRoom(roomID));
        listVisitedRooms.push(myCurrentRoom) // TODO Utile  ? (juste pour les stats de fin ? )
        for (let idConnectedRooms in myCurrentRoom.connectedRoomsID) { nextLevelListRoomsID.push(myCurrentRoom.connectedRoomsID[idConnectedRooms]) }
        listVisitedRoomID.push(myCurrentRoom.id);
        for (let chestID in myCurrentRoom.chests) {
          listChests.push(new Chest(myCurrentRoom.chests[chestID], null, myCurrentRoom.id)) 
        }
     }
  }, {concurrency: 500}); 
   return exploreCastleByLevel(nextLevelListRoomsID, level + 1)
  }
 
async function openRoom(pRoomID) {
  try {
    const response = await fetch(castleURL + pRoomID);
    const roomData = await response.json();
    return new Room(roomData.id, roomData.rooms, roomData.chests);
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
