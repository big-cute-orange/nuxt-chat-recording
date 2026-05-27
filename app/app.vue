<template>
    <div>
        <NuxtLoadingIndicator color="var(--accent, #7c6fcd)" :height="3" />
        <NuxtPage :transition="{ name: 'page' }" />
    </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
    transition: opacity 0.15s ease;
}

.page-enter-from,
.page-leave-to {
    opacity: 0;
}
</style>
