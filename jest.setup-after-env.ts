import { configure } from '@testing-library/react-native';

// Screen tests wait on network-shaped async work (fake fetch + React Query + GPS). RNTL's
// default 1s wait is enough on a warm laptop but not on a cold CI machine or under coverage,
// where the first run compiles and instruments every file. These only raise the ceiling:
// tests still finish as soon as the condition is met.
configure({ asyncUtilTimeout: 5000 });
