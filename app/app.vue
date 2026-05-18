<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup>
useHead({
  meta: [{ name: 'google', content: 'notranslate' }],
})
</script>
