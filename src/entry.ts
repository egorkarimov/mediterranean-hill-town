import { Runtime } from 'foldkit'

import { Flags, Model, init, subscriptions, update, view } from './main'
import './styles.css'

const application = Runtime.makeApplication({
  Model,
  Flags,
  init,
  update,
  view,
  subscriptions,
  container: document.getElementById('root'),
})

Runtime.hydrate(application)
