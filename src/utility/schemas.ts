import mongoose, { Schema } from 'mongoose';

export const UserSchema = new Schema({
  id:  String,
  username: String,
  password: String,
  session: String,
  rooms: Array
})

export const UserModel = mongoose.model('User', UserSchema)

export const MessageSchema = new Schema({
  id: String,
  author: String,
  body: String,
  date: Date
})

export const MessageModel = mongoose.model('Message', MessageSchema)

export const RoomSchema = new Schema({
  id: String,
  owner: String,
  name: String,
  public: Boolean,
  password: String,
  members: Array,
  messages: [MessageSchema]
})

export const RoomModel = mongoose.model('Room', RoomSchema)