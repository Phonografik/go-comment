// Every date-sensitive test runs in Europe/London so DST transitions are real
// (BST starts on the last Sunday of March, ends on the last Sunday of October).
// calendar.test.ts asserts this actually took effect.
process.env.TZ = 'Europe/London';
