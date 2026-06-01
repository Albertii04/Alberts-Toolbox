import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import Presenter from './Presenter.vue'

const isPresenter = new URLSearchParams(location.search).has('p')

createApp(isPresenter ? Presenter : App).mount('#app')
