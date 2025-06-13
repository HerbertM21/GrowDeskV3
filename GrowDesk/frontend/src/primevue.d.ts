declare module 'primevue/primevue.esm.js' {
  import PrimeVue from 'primevue/config';
  export default PrimeVue;
}

declare module 'primevue/config' {
  import { Plugin } from 'vue';
  const PrimeVue: Plugin;
  export default PrimeVue;
}

declare module 'primevue/*' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
} 