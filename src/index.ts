import cors from 'cors'
import express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import { AddressInfo } from 'net';
import mongoose from 'mongoose';
import Timer = NodeJS.Timer;
import { config } from 'dotenv';
import jwt from 'jsonwebtoken'
import { VerifySessionToken } from './utility/util';
import { RoomRoute, TestRoute, UserRoute } from './routes';
import WebsocketBus from './classes/WebsocketBus';
config()

mongoose.connect(process.env.DB_CONN_SECRET || "")

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });
export const WSBus = new WebsocketBus(wss);

app.use(cors({ origin: '*' }))
app.use(express.json())
// Authorization Middleware
app.use((req, res, next) => {
  const authorization = req.headers['authorization']
  req.session = {
    token: authorization ? authorization : null,
    id: VerifySessionToken(authorization)
  }
  next()
})
if (process.argv.includes("--dev")) app.use(TestRoute.path, TestRoute.router)
app.use(UserRoute.path, UserRoute.router)
app.use(RoomRoute.path, RoomRoute.router)

app.all('/ping', (req, res) => {
  return res.status(200).send('pong')
})

server.listen(process.env.PORT || 5449, () => {
  console.log(`Server started on port ${(server.address() as AddressInfo).port}`);
});

process.on('exit', () => {
  wss.close()
  server.close()
})