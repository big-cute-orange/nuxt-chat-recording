<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtWelcome />
    <UButton>Click me! {{ a }}</UButton>
  </UApp>
</template>

<script setup lang="js">
let a = ref(false)
</script>
