// Importamos los componentes individuales de PrimeVue que necesitamos
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Toast from 'primevue/toast'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import ColumnGroup from 'primevue/columngroup'
import InputSwitch from 'primevue/inputswitch'
import Checkbox from 'primevue/checkbox'
import Calendar from 'primevue/calendar'

// Función para instalar PrimeVue en la aplicación
export function setupPrimeVue(app: any) {
  // Registrar componentes globalmente
  app.component('PrimeButton', Button)
  app.component('PrimeInputText', InputText)
  app.component('PrimeToast', Toast)
  app.component('PrimeDialog', Dialog)
  app.component('PrimeDropdown', Dropdown)
  app.component('PrimeCard', Card)
  app.component('PrimeDataTable', DataTable)
  app.component('PrimeColumn', Column)
  app.component('PrimeColumnGroup', ColumnGroup)
  app.component('PrimeInputSwitch', InputSwitch)
  app.component('PrimeCheckbox', Checkbox)
  app.component('PrimeCalendar', Calendar)
  
  // ToastService ya se registra en main.ts
  
  console.log('PrimeVue 4.3.5 configurado correctamente')
} 