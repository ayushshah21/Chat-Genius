Embrace Simplicity Over Cleverness

Write code that's easy for others to follow.
If it feels complicated, simplify.
Optimize for clarity first, then performance when needed.
Avoid tricky one-liners.
ts
Copy code
// Bad
export function getPrimes(maxNumber: number): number[] {
  return Array.from({ length: maxNumber }, (_, i) => i)
    .filter((n) => n > 1)
    .filter((n) =>
      Array.from({ length: n }, (_, i) => i).slice(2).every((i) => n % i !== 0)
    );
}

// Good
export function findPrimeNumbers(maxNumber: number): number[] {
  const primes: number[] = [];
  for (let num = 2; num < maxNumber; num++) {
    if (isPrime(num)) {
      primes.push(num);
    }
  }
  return primes;
}

function isPrime(num: number): boolean {
  if (num < 2) return false;
  for (let i = 2; i <= Math.sqrt(num); i++) {
    if (num % i === 0) return false;
  }
  return true;
}
Focus on Core Functionality

Start with minimal features.
Add functionality only when necessary.
Remove any unused code.
ts
Copy code
// Bad: Overengineered from the start
class UserManager {
  private db: any;
  private cache: any;
  private logger: any;
  private metrics: any;
  private notification: any;

  constructor(db: any, cache: any, logger: any, metrics: any, notification: any) {
    this.db = db;
    this.cache = cache;
    this.logger = logger;
    this.metrics = metrics;
    this.notification = notification;
  }
}

// Good: Start simple, expand later
class UserManager {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }
}
Leverage Existing Solutions

Use standard libraries and popular packages.
Don’t reinvent the wheel.
Keep dependencies minimal but effective.
ts
Copy code
// Bad: Custom JSON parsing
import fs from 'fs';

function parseJsonFile(filePath: string): any {
  const fileData = fs.readFileSync(filePath, 'utf8');
  // custom parsing...
  return {}; // not actually parsing
}

// Good: Use standard methods
import fs from 'fs';

function readConfig(filePath: string): any {
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}
Function Design

Each function does one thing.
Keep them short.
Limit parameters when possible.
Use descriptive names.
ts
Copy code
// Bad: Multiple responsibilities
async function processUserData(userData: any) {
  if (validateUser(userData)) {
    await saveUserToDatabase(userData);
    sendWelcomeEmail(userData);
    updateMetrics(userData);
  }
}

// Good: Single responsibility
async function saveUser(userData: any): Promise<string> {
  if (!userData) throw new Error('User data cannot be empty');
  return await prisma.user.create({ data: userData });
}
Project Structure

Keep related code together.
A flat structure is usually simpler.
css
Copy code
my-project/
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── routes/
│   │   └── controllers/
│   ├── prisma/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   └── styles/
│   ├── package.json
└── docker-compose.yml
Code Review Guidelines

Check for simplicity first.
Reduce duplication.
Keep naming conventions consistent.
Maintenance Practices

Remove unused code regularly.
Keep dependencies updated.
Refactor when unclear.
Document only what's essential.
Debugging Approach

Identify symptoms.
Reproduce in a controlled environment.
Understand how the system’s parts interact.
Form a hypothesis about the issue.
Test that hypothesis, add logs or checks if needed.
Next Steps
Explore Example Project Setup – A minimal PERN structure (Node + Express + Postgres + Prisma + React + Vite + Tailwind).
Discuss Deployment – How to containerize and deploy.
Dive Into Testing – Unit and integration tests in a PERN stack.
Investigate Common Pitfalls – Common debugging scenarios and quick fixes.
