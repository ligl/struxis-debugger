<script setup lang="ts">
import { Toaster } from "vue-sonner";
</script>

<template>
  <Toaster
    class="app-toast-host"
    position="top-right"
    theme="dark"
    :rich-colors="true"
    :close-button="true"
    :duration="3800"
    :visible-toasts="4"
  />
</template>
