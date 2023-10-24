/* 
Last update : 20241023
*/

import Bottleneck from "bottleneck";
import retry from 'async-retry'
import pMap from 'p-map';
const limiter = new Bottleneck({ maxConcurrent: 1000, minTime: 0 });
const listVisitedRooms = []
const listChests = []
const CHEST_EMPTY_STATUS = "This chest is empty :/ Try another one!"
const CASTLE_URL = "https://infinite-castles.azurewebsites.net/"
const CASTLE_ENTRY = "castles/1/rooms/entry"
const DISPLAY_SUMMARY=false

startExploration()

async function startExploration() {
  await exploreCastleByLevel([CASTLE_ENTRY])
  await openChestInventory(listChests)
  displayChestData(DISPLAY_SUMMARY)
}
//Récupère le status des chests (call API)
async function getChestStatus(pChest) {

  return retry(async bail => {
    try {
      let response = await fetch(CASTLE_URL + pChest.id);
      if (!response.ok) throw new Error('Network response KO :  ' + response.statusText);
      let chestData = await response.json();
      pChest.status = chestData.status
    } catch (error) {
      console.log(JSON.stringify(response))
      bail(error) 
    }
  }, {
    retries: 5,
  })
}
//Parcours la liste des "chest" pour ensuite récupérer leur status
async function openChestInventory(pListChest) {
  await pMap(pListChest, async chest => {
    await limiter.schedule(() => getChestStatus(chest));
  }, {concurrency: 500}); 
}
//Affiche les informaiton récupérées sur les "chests"
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
//Explore les "room" de chaque niveau du chateau
async function exploreCastleByLevel(pListRoomsIDs, level) {
  if(pListRoomsIDs.length==0)return
  let nextLevelListRoomsID = [] 
  await pMap(pListRoomsIDs, async roomID => {

     if (listVisitedRooms.some((myRoom => myRoom.id === roomID)) == false) 
     {let myCurrentRoom = await limiter.schedule(() => openRoom(roomID));
        listVisitedRooms.push(myCurrentRoom)
        for (let idConnectedRooms in myCurrentRoom.connectedRoomsID) { nextLevelListRoomsID.push(myCurrentRoom.connectedRoomsID[idConnectedRooms]) }
        for (let chestID in myCurrentRoom.chests) {
          listChests.push(new Chest(myCurrentRoom.chests[chestID], null, myCurrentRoom.id)) 
        }
     }
  }, {concurrency: 500}); 
   return exploreCastleByLevel(nextLevelListRoomsID)
  }
//Récupère les information sur une "room" (call API)
async function openRoom(pRoomID) {
  try {
    const response = await fetch(CASTLE_URL + pRoomID);
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
