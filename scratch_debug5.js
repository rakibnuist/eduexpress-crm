import { initDatabase } from './sqldb.js';
import { createServer } from 'http';
import app from './server.js'; // This won't work because server.js might not export app or it starts listening.

// Let's just find out why createLeadFromContact returns null.
