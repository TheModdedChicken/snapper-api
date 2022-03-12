import { Router } from "express";
import mongoose from "mongoose";
import { UserPasswordRegex, UsernameRegex } from "../utility/regex";
import { UserModel } from "../utility/schemas";
import { GenerateUUID, rAsync, VerifySessionToken } from "../utility/util";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Snowflake } from 'nodejs-snowflake';

const UserRouter = Router();

UserRouter.post('/create', rAsync(async (req, res) => {
  if (!req.body.username) return res.status(401).send({message: "Username was not provided", code: "usernameMissing"});
  const userSearch = await UserModel.findOne({ username: req.body.username }).exec();
  if (userSearch) return res.status(401).send({message: "Username is Taken", code: "usernameTaken"});
  if (!UsernameRegex.test(req.body.username)) return res.status(401).send({message: "Username is invalid", code: "usernameInvalid"});
  if (!req.body.password) return res.status(401).send({message: "Password was not provided", code: "passwordMissing"});
  if (!UserPasswordRegex.test(req.body.password)) return res.status(401).send({message: "Password is invalid", code: "passwordInvalid"});
  
  const user = await CreateUser(req.body.username, req.body.password)
  return res.status(200).send({
    message: "Created new user successfully",
    data: user
  })
}))

UserRouter.post('/login', rAsync(async (req, res) => {
  if (!req.body.username) return res.status(401).send({message: "Username was not provided", code: "usernameMissing"});
  if (!UsernameRegex.test(req.body.username)) return res.status(401).send({message: "Username is invalid", code: "usernameInvalid"});
  if (!req.body.password) return res.status(401).send({message: "Password was not provided", code: "passwordMissing"});
  if (!UserPasswordRegex.test(req.body.password)) return res.status(401).send({message: "Password is invalid", code: "passwordInvalid"});

  const user = await UserModel.findOne({ username: req.body.username }).exec();
  if (!UsernameRegex.test(req.body.username) || !user) return res.status(401).send({message: "Username is invalid", code: "usernameInvalid"});
  if (bcrypt.compareSync(req.body.password, user.password)) {
    return res.status(200).send({
      message: "Logged in successfully",
      session: GenerateSessionToken(user.id)
    })
  }
}))

UserRouter.delete('/logout', rAsync(async (req, res) => {
  if (!req.session.id) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});

  UserModel.findOneAndUpdate({ id: req.session.id }, { session: null }, (err: mongoose.CallbackError, data: any) => {
    if (err || !data) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});
    return res.status(200).send({
      message: "Logged out successfully"
    })
  })
}))

UserRouter.delete('/:id/delete', rAsync(async (req, res) => {
  if (req.session.id !== req.params.id) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});

  UserModel.findOneAndRemove({ id: req.session.id }, (err: mongoose.CallbackError, data: any) => {
    if (err || !data) return res.status(401).send({message: "Invalid Session Token", code: "invalidSession"});
    return res.status(200).send({
      message: "Deleted user successfully"
    })
  })
}))

export default {
  router: UserRouter,
  path: '/user'
}

export async function CreateUser (username: string, password: string) {
  const id = `${GenerateUUID()}`;
  const userData = {
    id,
    username,
    session: GenerateSessionToken(id)
  }

  await new UserModel({
    ...userData, 
    password: bcrypt.hashSync(password, 10)
  }).save()
  return userData
}

export function GenerateSessionToken (id: string) {
  const token = jwt.sign({ id }, process.env.SESSION_TOKEN_SECRET as any, {expiresIn: '1y'});

  UserModel.findOneAndUpdate({ id }, { session: token }, (err: mongoose.CallbackError, data: any) => {
    if (err) throw err;
  })

  return token;
}