import { Router } from "express";

const TestRouter = Router();

TestRouter.all('/test', (req, res) => {
  console.log(req.session)
  return res.sendStatus(200)
})

export default {
  router: TestRouter,
  path: '/'
}