import * as WebSocket from 'ws';

export interface IWebsocketServerData {
  status: number
  code?: string
  message?: string
  body?: any
}

export interface IWebsocketClientData {
  code?: string
  body: any
}

export interface IWebsocketConn {
  id: string
  ttl: NodeJS.Timeout
  websockets: WebSocket[]
}

export interface IRoomMessage {
  id: string
  author: string
  body: string
  date: Date
}