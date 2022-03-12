namespace Express {
  interface Request {
    session: {
      token: string | null,
      id: string | null
    }
  }
}