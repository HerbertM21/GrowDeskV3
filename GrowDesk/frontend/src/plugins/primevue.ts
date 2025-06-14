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
import Menu from 'primevue/menu'
import Menubar from 'primevue/menubar'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Panel from 'primevue/panel'
import Textarea from 'primevue/textarea'
import Badge from 'primevue/badge'
import Avatar from 'primevue/avatar'
import Divider from 'primevue/divider'
import Message from 'primevue/message'
import Tooltip from 'primevue/tooltip'
import ProgressSpinner from 'primevue/progressspinner'

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
  app.component('PrimeMenu', Menu)
  app.component('PrimeMenubar', Menubar)
  app.component('PrimeTabView', TabView)
  app.component('PrimeTabPanel', TabPanel)
  app.component('PrimePanel', Panel)
  app.component('PrimeTextarea', Textarea)
  app.component('PrimeBadge', Badge)
  app.component('PrimeAvatar', Avatar)
  app.component('PrimeDivider', Divider)
  app.component('PrimeMessage', Message)
  app.component('PrimeProgressSpinner', ProgressSpinner)
  
  // Directivas
  app.directive('tooltip', Tooltip)
  
  console.log('PrimeVue 4.3.5 configurado correctamente con componentes adicionales')
} 