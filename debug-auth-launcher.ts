#!/usr/bin/env tsx
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Now that env is loaded, import the debug script
import './debug-auth';