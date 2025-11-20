<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'
import {RsimzoClient} from '@jx_code/rsimzo-client'

const rsimzo = new RsimzoClient({
  publicKey: 'eyJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3NjA5NTU5NTMsImV4cCI6MTc5MjQ5MTk1MywiaWQiOiJiYzI0Y2JhNi05ZDE1LTQ4YjktOGIwYi1mZjNiOTZjOTcxMTciLCJkb21haW4iOiJodWpqYXQudXoifQ.wS5rzWo8L9WsVd7Yg430cW443YtOTYDlu9Rt5DNyA4U'
})
</script>

<template>
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
  <button @click="rsimzo.sign('2e12699ecb54b2e2', '123', {locale: 'en'})">sign</button>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
