declare module 'primevue/config' {
  import { Plugin } from 'vue';
  const PrimeVue: Plugin;
  export default PrimeVue;
}

declare module 'primevue/toastservice' {
  import { Plugin } from 'vue';
  const ToastService: Plugin;
  export default ToastService;
}

declare module 'primevue/*' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
} 