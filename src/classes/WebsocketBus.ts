import * as WebSocket from 'ws';
import { IWebsocketClientData, IWebsocketConn, IWebsocketServerData } from "../utility/interfaces";
import { VerifySessionToken } from '../utility/util';

// Websocket Codes: https://www.iana.org/assignments/websocket/websocket.xhtml

export default class WebsocketBus {
  private WSServer: WebSocket.Server;
  private WSConnections: IWebsocketConn[] = [];

  constructor(wss: WebSocket.Server) { 
    this.WSServer = wss;
    this.WSServer.on('connection', (ws: WebSocket) => {
      this.handle(ws)
      ws.send(JSON.stringify({
        status: 200,
        code: "waitingForAuth"
      }))
    })
  }

  handle (ws: WebSocket) {
    ws.on('message', (data) => this.messageHandler(ws, data))
  }

  send (id: string, data: IWebsocketServerData) {
    const WSConn = this.WSConnections.find(conn => conn.id === id)
    if (!WSConn) throw `Unable to find websocket connection with id ${id}`;

    for (const ws of WSConn.websockets) {
      ws.send(JSON.stringify(data))
    }
  }

  private messageHandler (ws: WebSocket, dataBuffer: WebSocket.RawData) {
    try {
      const data: IWebsocketClientData = JSON.parse(dataBuffer.toString('utf-8'));
      try {
        // @ts-ignore
        this.WebsocketCodes[data.code](ws, data);
      } catch (err: any) {
        console.log(err)
        ws.send(JSON.stringify(err))
      }
    } catch (err) {
      ws.send(JSON.stringify({
        status: 415,
        message: "Invalid JSON",
        code: "jsonInvalid"
      }))
    }
  }

  private ttlHandler (id: string) {
    const WSConn = this.WSConnections.find(conn => conn.id === id);
    if (WSConn) for (const ws of WSConn.websockets) {
      ws.close(3000, JSON.stringify({
        status: 401,
        code: "ttlExpired"
      }))
    }
    var newConns = this.WSConnections.filter(conn => conn.id !== id)
    this.WSConnections = newConns
  }

  private WebsocketCodes = {
    authorization: (ws: WebSocket, data: IWebsocketClientData) => {
      const user_id = VerifySessionToken(data.body.authorization)
      if (!user_id) throw {
        status: 401,
        message: "Invalid Session Token",
        code: "sessionTokenInvalid"
      }

      if (!data.body.ttl || data.body.ttl > 600000 || data.body.ttl < 10000) throw {
        status: 401,
        message: "Invalid time to live",
        code: "ttlNotSpecified"
      }
      const ttl = setTimeout(() => this.ttlHandler(user_id), data.body.ttl)
  
      this.WSConnections.push({
        id: user_id,
        ttl,
        websockets: [ws]
      })

      return ws.send(JSON.stringify({
        status: 200,
        message: "Connection Authorized",
        code: "connectionAuthorized"
      }))
    },
    ttl: (ws: WebSocket, data: IWebsocketClientData) => {
      const user_id = VerifySessionToken(data.body.authorization)
      if (!user_id) throw {
        status: 401,
        message: "Invalid Session Token",
        code: "sessionTokenInvalid"
      }

      if (!data.body.ttl || data.body.ttl > 600000 || data.body.ttl < 10000) throw {
        status: 401,
        message: "Invalid time to live",
        code: "ttlNotSpecified"
      }

      const conn = this.WSConnections.find(conn => conn.id === user_id)
      if (!conn) throw {
        status: 401,
        message: "Invalid Session Token",
        code: "sessionTokenInvalid"
      }

      clearTimeout(conn.ttl)
      conn.ttl = setTimeout(() => this.ttlHandler(conn.id), data.body.ttl)
      return ws.send(JSON.stringify({
        status: 200,
        message: "Reset time to live",
        code: "ttlReset"
      }))
    }
  }
}