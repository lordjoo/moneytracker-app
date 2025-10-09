import {
  AcademicCapIcon,
  ArrowsRightLeftIcon,
  BanknotesIcon,
  BriefcaseIcon,
  BuildingLibraryIcon,
  ChartBarIcon,
  CreditCardIcon,
  GiftTopIcon,
  HeartIcon,
  HomeIcon,
  PresentationChartLineIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TruckIcon,
  UserGroupIcon,
  WalletIcon,
  WrenchScrewdriverIcon
} from '@heroicons/vue/24/solid';

export const CATEGORY_ICON_OPTIONS = [
  { value: 'home', label: 'Home', component: HomeIcon },
  { value: 'shopping-bag', label: 'Shopping bag', component: ShoppingBagIcon },
  { value: 'shopping-cart', label: 'Shopping cart', component: ShoppingCartIcon },
  { value: 'truck', label: 'Transportation', component: TruckIcon },
  { value: 'sparkles', label: 'Entertainment', component: SparklesIcon },
  { value: 'heart', label: 'Health', component: HeartIcon },
  { value: 'wallet', label: 'Savings', component: WalletIcon },
  { value: 'banknotes', label: 'Salary', component: BanknotesIcon },
  { value: 'arrows-right-left', label: 'Transfer', component: ArrowsRightLeftIcon },
  { value: 'briefcase', label: 'Business', component: BriefcaseIcon },
  { value: 'gift', label: 'Gifts', component: GiftTopIcon },
  { value: 'credit-card', label: 'Credit', component: CreditCardIcon },
  { value: 'academic-cap', label: 'Education', component: AcademicCapIcon },
  { value: 'presentation-chart-line', label: 'Analytics', component: PresentationChartLineIcon },
  { value: 'chart-bar', label: 'Reports', component: ChartBarIcon },
  { value: 'user-group', label: 'Family', component: UserGroupIcon },
  { value: 'building-library', label: 'Loans', component: BuildingLibraryIcon },
  { value: 'wrench-screwdriver', label: 'Maintenance', component: WrenchScrewdriverIcon }
];

const CATEGORY_ICON_MAP = CATEGORY_ICON_OPTIONS.reduce((map, option) => {
  map[option.value] = option.component;
  return map;
}, {});

export function resolveCategoryIcon(name) {
  return CATEGORY_ICON_MAP[name] ?? null;
}

export const FALLBACK_CATEGORY_ICON = WalletIcon;
