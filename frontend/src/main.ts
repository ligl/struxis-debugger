import { createApp } from "vue";
import App from "./App.vue";
import { mountDocumentContextMenu } from "./document-context-menu";
import "./style.css";

createApp(App).mount("#app");
mountDocumentContextMenu();
