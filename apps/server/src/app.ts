import express, { type Express } from 'express';
import { pingDatabase } from './db/index.js';
import { createHealthRouter } from './routes/health.js';
import { createAuthRouter } from './routes/auth.js';
import { createAdminUsersRouter } from './routes/admin-users.js';
import { createAdminOperationsRouter } from './routes/admin-operations.js';
import { createPublicMoviesRouter } from './routes/public-movies.js';
import { createBookingRouter } from './routes/booking.js';
import { createPaymentRouter } from './routes/payment.js';
import { createProfileRouter } from './routes/profile.js';
import { createPosTicketRouter } from './routes/pos-ticket.js';
import { createValidatorRouter } from './routes/validator.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createAuthService, type AuthService } from './services/auth-service.js';
import {
  createAdminUserService,
  type AdminUserService,
} from './services/admin-user-service.js';
import {
  createOperationsService,
  type OperationsService,
} from './services/operations-service.js';
import {
  createPublicMovieService,
  type PublicMovieService,
} from './services/public-movie-service.js';
import {
  createBookingService,
  type BookingService,
} from './services/booking-service.js';
import {
  createPaymentService,
  type PaymentService,
} from './services/payment-service.js';
import {
  createTicketPosService,
  type TicketPosService,
} from './services/ticket-pos-service.js';
import {
  createValidatorService,
  type ValidatorService,
} from './services/validator-service.js';
import {
  createDashboardService,
  type DashboardService,
} from './services/dashboard-service.js';
import { createTmdbClient, type TmdbClient } from './services/tmdb-service.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export interface AppDependencies {
  checkDb?: () => Promise<boolean>;
  authService?: AuthService;
  adminUserService?: AdminUserService;
  operationsService?: OperationsService;
  publicMovieService?: PublicMovieService;
  bookingService?: BookingService;
  paymentService?: PaymentService;
  ticketPosService?: TicketPosService;
  validatorService?: ValidatorService;
  dashboardService?: DashboardService;
  tmdbClient?: TmdbClient;
  secureCookie?: boolean;
}

export function createApp(deps: AppDependencies = {}): Express {
  const app = express();
  const checkDb = deps.checkDb ?? pingDatabase;
  const authService = deps.authService ?? createAuthService();
  const adminUserService = deps.adminUserService ?? createAdminUserService();
  const tmdbClient = deps.tmdbClient ?? createTmdbClient();
  const operationsService = deps.operationsService ?? createOperationsService(undefined, tmdbClient);
  const publicMovieService =
    deps.publicMovieService ?? createPublicMovieService(undefined, tmdbClient);
  const bookingService = deps.bookingService ?? createBookingService();
  const paymentService = deps.paymentService ?? createPaymentService();
  const ticketPosService = deps.ticketPosService ?? createTicketPosService();
  const validatorService = deps.validatorService ?? createValidatorService();
  const dashboardService = deps.dashboardService ?? createDashboardService();
  const secureCookie = deps.secureCookie ?? process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/v1', createHealthRouter(checkDb));
  app.use('/api/v1', createAuthRouter(authService, secureCookie));
  app.use('/api/v1', createAdminUsersRouter(authService, adminUserService, secureCookie));
  app.use('/api/v1', createAdminOperationsRouter(authService, operationsService, secureCookie));
  app.use('/api/v1', createPublicMoviesRouter(authService, publicMovieService, secureCookie));
  app.use('/api/v1', createBookingRouter(authService, bookingService, secureCookie));
  app.use('/api/v1', createPaymentRouter(authService, paymentService, secureCookie));
  app.use('/api/v1', createProfileRouter(authService, paymentService, secureCookie));
  app.use('/api/v1', createPosTicketRouter(authService, ticketPosService, secureCookie));
  app.use('/api/v1', createValidatorRouter(authService, validatorService, secureCookie));
  app.use('/api/v1', createDashboardRouter(authService, dashboardService, secureCookie));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
