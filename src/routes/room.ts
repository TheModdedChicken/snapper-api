import { Router } from "express";
import mongoose from "mongoose";
import { RoomPasswordRegex, RoomNameRegex } from "../utility/regex";
import { RoomModel, UserModel } from "../utility/schemas";
import { FilterObject, GenerateUUID, rAsync, VerifySessionToken } from "../utility/util";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Snowflake } from 'nodejs-snowflake';
import { WSBus } from "..";
import { IRoomMessage } from "../utility/interfaces";

const RoomRouter = Router();

RoomRouter.post('/create', rAsync(async (req, res) => {
  if (!req.session.id) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});
  if (!req.body.name) return res.status(401).send({message: "Room name was not provided", code: "roomNameMissing"});
  if (!RoomNameRegex.test(req.body.name)) return res.status(401).send({message: "Invalid Room Name", code: "roomNameInvalid"});
  if (!RoomPasswordRegex.test(req.body.password)) return res.status(401).send({message: "Password is invalid", code: "passwordInvalid"});

  const user = await UserModel.findOne({ id: req.session.id }).exec();
  if (!user) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});
  const room = await CreateRoom(user, req.body.name, req.body.password, req.body.public);

  await UserModel.updateOne({ id: req.session.id }, { $push: { rooms: room.id } });

  return res.status(200).send({
    message: "Created new room successfully",
    data: room
  })
}))

RoomRouter.post('/:id/join', rAsync(async (req, res) => {
  if (!req.session.id) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});

  const user = await UserModel.findOne({ id: req.session.id }).exec();
  if (!user) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});
  if (user.rooms.includes(req.params.id)) return res.status(404).send({message: "You are already a member of this room", code: "alreadyMemberOfRoom"});

  const room = await RoomModel.findOneAndUpdate({ id: req.params.id }, { $push: { members: user.id } }).exec();
  if (!room) return res.status(404).send({message: "Room not found", code: "invalidRoom"});
  if (room.password && !bcrypt.compareSync(req.body.password || "", room.password)) return res.status(401).send({message: "Invalid Password", code: "passwordInvalid"});

  await UserModel.updateOne({ id: req.session.id }, { $push: { rooms: req.params.id } }).exec();

  return res.status(200).send({
    message: "Joined room successfully"
  })
}))

RoomRouter.post('/:id/messages', rAsync(async (req, res) => {
  if (!req.session.id) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});

  const user = await UserModel.findOne({ id: req.session.id }).exec();
  if (!user) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});
  if (!user.rooms.includes(req.params.id)) return res.status(404).send({message: "You are not a member of this room", code: "notMemberOfRoom"});

  const room = await RoomModel.findOne({ id: req.params.id }).exec();
  if (!room) return res.status(404).send({message: "Room not found", code: "invalidRoom"});

  if (!req.body.body) return res.status(401).send({message: "Invalid Message Body", code: "messageBodyInvalid"});
  await CreateMessage(room.id, req.session.id, req.body.body)

  return res.status(200).send({
    message: "Created message successfully"
  })
}))

// Messages
RoomRouter.delete('/:room_id/messages/:message_id/delete', rAsync(async (req, res) => {
  if (!req.session.id) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});

  const user = await UserModel.findOne({ id: req.session.id }).exec();
  if (!user) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});
  if (!user.rooms.includes(req.params.room_id)) return res.status(404).send({message: "You are not a member of this room", code: "notMemberOfRoom"});

  const room = await RoomModel.findOne({ id: req.params.room_id }).exec();
  if (!room) return res.status(404).send({message: "Room not found", code: "invalidRoom"});

  var message: IRoomMessage = room.messages.find((m :IRoomMessage) => m.id === req.params.message_id);
  if (!message) return res.status(401).send({message: "Message not found", code: "invalidMessage"});
  if (message.author !== user.id) return res.status(401).send({message: "You aren't the author of this message", code: "notAuthorOfMessage"});
  await DeleteMessage(room.id, message.id)

  return res.status(200).send({
    message: "Created message successfully"
  })
}))

RoomRouter.delete('/:id/leave', rAsync(async (req, res) => {
  if (!req.session.id) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});

  const user = await UserModel.findOne({ id: req.session.id }).exec();
  if (!user) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});
  if (!user.rooms.includes(req.params.id)) return res.status(404).send({message: "You are not a member of this room", code: "notMemberOfRoom"});

  const room = await RoomModel.findOneAndUpdate({ id: req.params.id }, { $pull: { members: user.id } }).exec();
  if (!room) return res.status(404).send({message: "Room not found", code: "invalidRoom"});

  await UserModel.updateOne({ id: req.session.id }, { $pull: { rooms: req.params.id } });

  return res.status(200).send({
    message: "Left room successfully"
  })
}))

RoomRouter.delete('/:id/delete', rAsync(async (req, res) => {
  if (!req.session.id) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});

  const user = await UserModel.findOne({ id: req.session.id }).exec();
  if (!user) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});
  if (!user.rooms.includes(req.params.id)) return res.status(404).send({message: "You are not a member of this room", code: "notMemberOfRoom"});

  const room = await RoomModel.findOne({ id: req.params.id }).exec();
  if (!room) return res.status(404).send({message: "Room not found", code: "invalidRoom"});
  if (room.owner !== req.session.id) return res.status(404).send({message: "You are not the owner of this room", code: "notOwnerOfRoom"});

  await RoomModel.deleteOne({ id: req.params.id }).exec();
  await UserModel.updateOne({ id: req.session.id }, { $pull: { rooms: req.params.id } });

  return res.status(200).send({
    message: "Deleted room successfully"
  })
}))

RoomRouter.patch('/:id/info', rAsync(async (req, res) => {
  if (!req.session.id) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});

  const user = await UserModel.findOne({ id: req.session.id }).exec();
  if (!user) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});
  if (!user.rooms.includes(req.params.id)) return res.status(404).send({message: "You are not a member of this room", code: "notMemberOfRoom"});

  const room = await RoomModel.findOne({ id: req.params.id }).exec();
  if (!room) return res.status(404).send({message: "Room not found", code: "invalidRoom"});
  if (room.owner !== req.session.id) return res.status(404).send({message: "You are not the owner of this room", code: "notOwnerOfRoom"});

  if (req.body.password && !RoomPasswordRegex.test(req.body.password)) return res.status(401).send({message: "Password is invalid", code: "passwordInvalid"});

  var inOut = FilterObject({ 
    name: req.body.name, 
    public: req.body.public, 
    password: 
      ![null, undefined].includes(req.body.password) ?
        bcrypt.hashSync(req.body.password, 10) 
      : null 
  })
  if (req.body.password === null) inOut.password = null
  if (Object.keys(inOut).length === 0) return res.status(404).send({message: "Did not provide data to patch", code: "noPatchData"});
  await RoomModel.updateOne({ id: room.id }, inOut).exec();

  return res.status(200).send({
    message: "Patched room info successfully"
  })
}))

export default {
  router: RoomRouter,
  path: '/room'
}

async function CreateMessage(roomID: string, userID: string, body: string) {
  const id = `${GenerateUUID()}`;
  const messageData = {
    id,
    author: userID,
    body,
    date: new Date()
  }

  const room = await RoomModel.findOneAndUpdate({ id: roomID }, { $push: { messages: messageData } }).exec()
  for (const member of room.members) {
    if (member !== userID) try {
      WSBus.send(member, {status: 200, code: "incomingMessage", body: messageData})
    } catch (err) {}
  }

  return messageData;
}

async function DeleteMessage(room_id: string, message_id: string) {
  const room = await RoomModel.findOneAndUpdate({ id: room_id }, { $pull: { messages: { $all: [ { id: message_id } ] } } }).exec()
  for (const member of room.members) {
    try {
      WSBus.send(member, {status: 200, code: "deletedMessage", body: {id: message_id}})
    } catch (err) {}
  }
}

async function CreateRoom (user: any, name: string, password?: string, isPublic = false) {
  const id = `${GenerateUUID()}`;
  const roomData = {
    id,
    owner: user.id,
    name,
    public: isPublic,
    members: [
      user.id
    ],
    messages: []
  }

  await new RoomModel({
    ...roomData,
    password: password ? await bcrypt.hash(password, 10) : false,
  }).save();
  return roomData;
}

async function JoinRoom (user: any, roomID: string) {

}