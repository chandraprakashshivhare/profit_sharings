import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, verifyPassword, createAccessToken, createRefreshToken, getUserFromRequest, verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import {
  allDirectorsDashboardExportCsv,
  companyDashboardExportCsv,
  directorDashboardExportCsv,
  transactionAuditExportCsv,
  transactionsListExportCsv
} from '@/lib/csv';
import {
  buildAuditListQuery,
  buildTransactionsListQuery,
  formatDashboardPeriodLabel,
  getCompanyDashboardData,
  getDirectorDashboardData
} from '@/lib/dashboardData';
import { insertTransactionAudit } from '@/lib/transactionAudit';

// Helper to set auth cookies
function setAuthCookies(response, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_BASE_URL?.includes('https');
  
  // Use NextResponse cookie API
  response.cookies.set({
    name: 'access_token',
    value: accessToken,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 900,
    path: '/'
  });
  
  response.cookies.set({
    name: 'refresh_token',
    value: refreshToken,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 604800,
    path: '/'
  });
  
  return response;
}

// Helper to clear auth cookies
function clearAuthCookies(response) {
  response.cookies.delete('access_token');
  response.cookies.delete('refresh_token');
  return response;
}

// Auth Middleware
async function requireAuth(request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return user;
}

export async function GET(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '') || '/';
  
  try {
    const db = await getDb();
    
    // Root
    if (path === '/') {
      return NextResponse.json({ message: 'Technomatz Finance API' });
    }
    
    // Auth - Get current user
    if (path === '/auth/me') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const director = await db.collection('directors').findOne({ id: user.sub });
      if (!director) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      const { password_hash, ...directorData } = director;
      return NextResponse.json(directorData);
    }
    
    // Projects - List
    if (path === '/projects') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const projects = await db.collection('projects').find({}).sort({ created_at: -1 }).toArray();
      return NextResponse.json(projects);
    }
    
    // Projects - Get by ID
    if (path.startsWith('/projects/')) {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const id = path.split('/')[2];
      const project = await db.collection('projects').findOne({ id });
      
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      
      return NextResponse.json(project);
    }
    
    // Transactions - CSV export (must be before /transactions/:id)
    if (path === '/transactions/csv') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;

      const { searchParams } = new URL(request.url);
      const period = searchParams.get('period') || 'all';
      const month = searchParams.get('month');
      const year = searchParams.get('year');
      const type = searchParams.get('type');
      const directorId = searchParams.get('director_id');
      const projectId = searchParams.get('project_id');

      const query = buildTransactionsListQuery({ period, month, year, type, directorId, projectId });
      const transactions = await db.collection('transactions').find(query).sort({ transaction_date: -1 }).toArray();

      const directors = await db
        .collection('directors')
        .find({ status: 'approved' })
        .project({ id: 1, name: 1 })
        .toArray();
      const directorNameById = Object.fromEntries(directors.map((d) => [d.id, d.name]));

      const projects = await db.collection('projects').find({}).project({ id: 1, name: 1 }).toArray();
      const projectNameById = Object.fromEntries(projects.map((p) => [p.id, p.name]));

      const csv = transactionsListExportCsv(transactions, directorNameById, projectNameById);
      const periodLabel = formatDashboardPeriodLabel(period, month, year);
      const safe = periodLabel.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'all';

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="transactions_${safe}.csv"`
        }
      });
    }

    // Transactions - List (active / non-deleted)
    if (path === '/transactions') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;

      const { searchParams } = new URL(request.url);
      const period = searchParams.get('period') || 'all';
      const month = searchParams.get('month');
      const year = searchParams.get('year');
      const type = searchParams.get('type');
      const directorId = searchParams.get('director_id');
      const projectId = searchParams.get('project_id');

      const query = buildTransactionsListQuery({ period, month, year, type, directorId, projectId });
      const transactions = await db.collection('transactions').find(query).sort({ transaction_date: -1 }).toArray();
      return NextResponse.json(transactions);
    }

    // Transactions - List (soft deleted only, all time)
    if (path === '/transactions/deleted') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;

      const transactions = await db
        .collection('transactions')
        .find({ is_deleted: true })
        .sort({ deleted_at: -1 })
        .toArray();
      return NextResponse.json(transactions);
    }

    // Transactions - Get by ID
    if (path.startsWith('/transactions/')) {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const id = path.split('/')[2];
      const transaction = await db.collection('transactions').findOne({ id, is_deleted: { $ne: true } });
      
      if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      
      return NextResponse.json(transaction);
    }

    // Transaction audit — CSV (must be before JSON list path)
    if (path === '/transaction-audit/csv') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;

      const { searchParams } = new URL(request.url);
      const period = searchParams.get('period') || 'all';
      const month = searchParams.get('month');
      const year = searchParams.get('year');

      const query = buildAuditListQuery({ period, month, year });
      const entries = await db
        .collection('transaction_audit')
        .find(query)
        .sort({ recorded_at: -1 })
        .toArray();

      const directors = await db.collection('directors').find({}).project({ id: 1, name: 1 }).toArray();
      const directorNameById = Object.fromEntries(directors.map((d) => [d.id, d.name]));

      const projects = await db.collection('projects').find({}).project({ id: 1, name: 1 }).toArray();
      const projectNameById = Object.fromEntries(projects.map((p) => [p.id, p.name]));

      const csv = transactionAuditExportCsv(entries, directorNameById, projectNameById);
      const periodLabel = formatDashboardPeriodLabel(period, month, year);
      const safe = periodLabel.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'all';

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="transaction-audit_${safe}.csv"`
        }
      });
    }

    // Transaction audit log (when actions were recorded — same period filter as transactions)
    if (path === '/transaction-audit') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;

      const { searchParams } = new URL(request.url);
      const period = searchParams.get('period') || 'all';
      const month = searchParams.get('month');
      const year = searchParams.get('year');

      const query = buildAuditListQuery({ period, month, year });
      const entries = await db
        .collection('transaction_audit')
        .find(query)
        .sort({ recorded_at: -1 })
        .toArray();
      return NextResponse.json(entries);
    }

    // Directors - List (only approved)
    if (path === '/directors') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const directors = await db.collection('directors').find({ status: 'approved' }).project({ password_hash: 0 }).toArray();
      return NextResponse.json(directors);
    }
    
    // Directors - Pending List
    if (path === '/directors/pending') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const pendingDirectors = await db.collection('directors').find({ status: 'pending' }).project({ password_hash: 0 }).toArray();
      return NextResponse.json(pendingDirectors);
    }
    
    // Directors - Get by ID
    if (path.startsWith('/directors/')) {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const id = path.split('/')[2];
      const director = await db.collection('directors').findOne({ id }, { projection: { password_hash: 0 } });
      
      if (!director) {
        return NextResponse.json({ error: 'Director not found' }, { status: 404 });
      }
      
      return NextResponse.json(director);
    }
    
    // Dashboard - Company (JSON)
    if (path === '/dashboard/company') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;

      const { searchParams } = new URL(request.url);
      const period = searchParams.get('period') || 'all';
      const month = searchParams.get('month');
      const year = searchParams.get('year');

      const data = await getCompanyDashboardData(db, period, month, year);
      const { transactions: _tx, ...summary } = data;
      return NextResponse.json(summary);
    }

    // Dashboard - Company (CSV export)
    if (path === '/dashboard/company/csv') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;

      const { searchParams } = new URL(request.url);
      const period = searchParams.get('period') || 'all';
      const month = searchParams.get('month');
      const year = searchParams.get('year');

      const data = await getCompanyDashboardData(db, period, month, year);
      const periodLabel = formatDashboardPeriodLabel(period, month, year);
      const csv = companyDashboardExportCsv(data);
      const safe = periodLabel.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'all';
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="company-dashboard_${safe}.csv"`
        }
      });
    }

    // Dashboard - All directors (CSV export)
    if (path === '/dashboard/directors/csv') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;

      const { searchParams } = new URL(request.url);
      const period = searchParams.get('period') || 'all';
      const month = searchParams.get('month');
      const year = searchParams.get('year');

      const approvedDirectors = await db
        .collection('directors')
        .find({ status: 'approved' })
        .project({ id: 1 })
        .toArray();

      const allDirectorData = await Promise.all(
        approvedDirectors.map((d) => getDirectorDashboardData(db, d.id, period, month, year))
      );

      const csv = allDirectorsDashboardExportCsv(allDirectorData);
      const periodLabel = formatDashboardPeriodLabel(period, month, year);
      const safe = periodLabel.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'all';
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="all-directors-dashboard_${safe}.csv"`
        }
      });
    }

    // Dashboard - Director (JSON)
    if (path === '/dashboard/director') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;

      const { searchParams } = new URL(request.url);
      const directorId = searchParams.get('director_id') || user.sub;
      const period = searchParams.get('period') || 'all';
      const month = searchParams.get('month');
      const year = searchParams.get('year');

      const data = await getDirectorDashboardData(db, directorId, period, month, year);
      const { transactions: _tx, ...summary } = data;
      return NextResponse.json(summary);
    }

    // Dashboard - Director (CSV export)
    if (path === '/dashboard/director/csv') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;

      const { searchParams } = new URL(request.url);
      const directorId = searchParams.get('director_id') || user.sub;
      const period = searchParams.get('period') || 'all';
      const month = searchParams.get('month');
      const year = searchParams.get('year');

      const data = await getDirectorDashboardData(db, directorId, period, month, year);
      const periodLabel = formatDashboardPeriodLabel(period, month, year);
      const csv = directorDashboardExportCsv(data);
      const namePart = (data.directorName || 'director').replace(/[^\w\-]+/g, '_').slice(0, 30);
      const safe = periodLabel.replace(/[^\w\-]+/g, '_').slice(0, 30);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="my-dashboard_${namePart}_${safe}.csv"`
        }
      });
    }
    
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '') || '/';
  
  try {
    const db = await getDb();
    
    // Auth - Register
    if (path === '/auth/register') {
      const body = await request.json();
      const { name, email, password } = body;
      
      if (!name || !email || !password) {
        return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
      }
      
      // Check if user exists
      const existingUser = await db.collection('directors').findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
      }
      
      // Hash password
      const passwordHash = await hashPassword(password);
      
      // Check if there are any approved directors
      const approvedDirectorsCount = await db.collection('directors').countDocuments({ status: 'approved' });
      
      // First director is auto-approved, others need approval
      const status = approvedDirectorsCount === 0 ? 'approved' : 'pending';
      
      // Create director
      const director = {
        id: uuidv4(),
        name,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        status: status,
        created_at: new Date()
      };
      
      await db.collection('directors').insertOne(director);
      
      // Remove password hash from response
      const { password_hash, ...directorData } = director;
      
      if (status === 'pending') {
        // Don't create tokens or login for pending directors
        return NextResponse.json({
          ...directorData,
          message: 'Registration submitted! Your account is pending approval from existing directors.',
          requiresApproval: true
        }, { status: 201 });
      }
      
      // Create tokens for auto-approved first director
      const accessToken = createAccessToken(director.id, director.email, director.name);
      const refreshToken = createRefreshToken(director.id);
      
      let response = NextResponse.json({
        ...directorData,
        access_token: accessToken,
        refresh_token: refreshToken,
        message: 'Welcome! You are the first director.'
      });
      response = setAuthCookies(response, accessToken, refreshToken);
      
      return response;
    }
    
    // Auth - Login
    if (path === '/auth/login') {
      const body = await request.json();
      const { email, password } = body;
      
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
      }
      
      // Find director
      const director = await db.collection('directors').findOne({ email: email.toLowerCase() });
      if (!director) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      
      // Check if director is approved
      if (director.status === 'pending') {
        return NextResponse.json({ error: 'Your account is pending approval from existing directors' }, { status: 403 });
      }
      
      if (director.status === 'rejected') {
        return NextResponse.json({ error: 'Your account registration was rejected' }, { status: 403 });
      }
      
      // Verify password
      const isValid = await verifyPassword(password, director.password_hash);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
      }
      
      // Create tokens
      const accessToken = createAccessToken(director.id, director.email, director.name);
      const refreshToken = createRefreshToken(director.id);
      
      // Remove password hash from response
      const { password_hash, ...directorData } = director;
      
      let response = NextResponse.json({
        ...directorData,
        access_token: accessToken,
        refresh_token: refreshToken
      });
      response = setAuthCookies(response, accessToken, refreshToken);
      
      return response;
    }
    
    // Auth - Logout
    if (path === '/auth/logout') {
      let response = NextResponse.json({ message: 'Logged out' });
      response = clearAuthCookies(response);
      return response;
    }
    
    // Auth - Refresh
    if (path === '/auth/refresh') {
      const refreshToken = request.cookies.get('refresh_token')?.value;
      
      if (!refreshToken) {
        return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
      }
      
      const payload = verifyToken(refreshToken);
      if (!payload || payload.type !== 'refresh') {
        return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
      }
      
      // Get director
      const director = await db.collection('directors').findOne({ id: payload.sub });
      if (!director) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      // Create new access token
      const accessToken = createAccessToken(director.id, director.email, director.name);
      
      let response = NextResponse.json({ message: 'Token refreshed' });
      response.cookies.set({
        name: 'access_token',
        value: accessToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_BASE_URL?.includes('https'),
        sameSite: 'lax',
        maxAge: 900,
        path: '/'
      });
      
      return response;
    }
    
    // Projects - Create
    if (path === '/projects') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const body = await request.json();
      const { name, salary, status, start_date, end_date, developer_name } = body;
      
      if (!name) {
        return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
      }
      
      const project = {
        id: uuidv4(),
        name,
        salary: salary || 0,
        status: status || 'active',
        start_date: start_date ? new Date(start_date) : null,
        end_date: end_date ? new Date(end_date) : null,
        developer_name: developer_name || null,
        created_at: new Date(),
        created_by: user.sub
      };
      
      await db.collection('projects').insertOne(project);
      return NextResponse.json(project);
    }
    
    // Transactions - Create
    if (path === '/transactions') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const body = await request.json();
      const { transaction_type, amount, account_type, director_id, project_id, from_director_id, to_director_id, description, transaction_date, bank_name, transaction_id } = body;
      
      if (!transaction_type || !amount) {
        return NextResponse.json({ error: 'Transaction type and amount are required' }, { status: 400 });
      }
      
      if (!['income', 'expense', 'loan', 'transfer'].includes(transaction_type)) {
        return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });
      }
      
      const transaction = {
        id: uuidv4(),
        transaction_type,
        amount: parseFloat(amount),
        account_type: account_type || 'company',
        director_id: director_id || null,
        project_id: project_id || null,
        from_director_id: from_director_id || null,
        to_director_id: to_director_id || null,
        description: description || '',
        bank_name: bank_name || null,
        transaction_id: transaction_id || null,
        transaction_date: transaction_date ? new Date(transaction_date) : new Date(),
        created_at: new Date(),
        created_by: user.sub
      };
      
      await db.collection('transactions').insertOne(transaction);
      await insertTransactionAudit(db, {
        action: 'create',
        actorId: user.sub,
        transaction
      });
      return NextResponse.json(transaction);
    }

    // Directors - Create
    if (path === '/directors') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const body = await request.json();
      const { name, email, password } = body;
      
      if (!name || !email || !password) {
        return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });
      }
      
      // Check if director exists
      const existingDirector = await db.collection('directors').findOne({ email: email.toLowerCase() });
      if (existingDirector) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
      }
      
      // Hash password
      const passwordHash = await hashPassword(password);
      
      // Create director
      const director = {
        id: uuidv4(),
        name,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        status: 'pending',
        created_at: new Date(),
        created_by: user.sub
      };
      
      await db.collection('directors').insertOne(director);
      
      // Remove password hash from response
      const { password_hash, ...directorData } = director;
      return NextResponse.json(directorData);
    }
    
    // Directors - Approve
    if (path.startsWith('/directors/approve/')) {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const id = path.split('/')[3];
      
      const result = await db.collection('directors').updateOne(
        { id, status: 'pending' },
        { $set: { status: 'approved', approved_at: new Date(), approved_by: user.sub } }
      );
      
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Pending director not found' }, { status: 404 });
      }
      
      return NextResponse.json({ message: 'Director approved successfully' });
    }
    
    // Directors - Reject
    if (path.startsWith('/directors/reject/')) {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const id = path.split('/')[3];
      
      const result = await db.collection('directors').updateOne(
        { id, status: 'pending' },
        { $set: { status: 'rejected', rejected_at: new Date(), rejected_by: user.sub } }
      );
      
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Pending director not found' }, { status: 404 });
      }
      
      return NextResponse.json({ message: 'Director rejected' });
    }
    
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '') || '/';
  
  try {
    const db = await getDb();
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    
    // Projects - Update
    if (path.startsWith('/projects/')) {
      const id = path.split('/')[2];
      const body = await request.json();
      
      const updateData = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.salary !== undefined) updateData.salary = body.salary;
      if (body.status !== undefined) updateData.status = body.status;
      if (body.start_date !== undefined) updateData.start_date = body.start_date ? new Date(body.start_date) : null;
      if (body.end_date !== undefined) updateData.end_date = body.end_date ? new Date(body.end_date) : null;
      if (body.developer_name !== undefined) updateData.developer_name = body.developer_name;
      updateData.updated_at = new Date();
      
      const result = await db.collection('projects').updateOne(
        { id },
        { $set: updateData }
      );
      
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      
      const project = await db.collection('projects').findOne({ id });
      return NextResponse.json(project);
    }
    
    // Transactions - Update
    if (path.startsWith('/transactions/')) {
      const id = path.split('/')[2];
      const body = await request.json();
      const existing = await db.collection('transactions').findOne({ id, is_deleted: { $ne: true } });
      if (!existing) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      const previous = {
        amount: existing.amount,
        transaction_type: existing.transaction_type
      };

      const updateData = {};
      if (body.transaction_type !== undefined) updateData.transaction_type = body.transaction_type;
      if (body.amount !== undefined) updateData.amount = parseFloat(body.amount);
      if (body.account_type !== undefined) updateData.account_type = body.account_type;
      if (body.director_id !== undefined) updateData.director_id = body.director_id;
      if (body.project_id !== undefined) updateData.project_id = body.project_id;
      if (body.from_director_id !== undefined) updateData.from_director_id = body.from_director_id;
      if (body.to_director_id !== undefined) updateData.to_director_id = body.to_director_id;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.bank_name !== undefined) updateData.bank_name = body.bank_name || null;
      if (body.transaction_id !== undefined) updateData.transaction_id = body.transaction_id || null;
      if (body.transaction_date !== undefined) updateData.transaction_date = new Date(body.transaction_date);
      updateData.updated_at = new Date();
      updateData.updated_by = user.sub;

      await db.collection('transactions').updateOne({ id }, { $set: updateData });

      const transaction = await db.collection('transactions').findOne({ id });
      await insertTransactionAudit(db, {
        action: 'update',
        actorId: user.sub,
        transaction,
        previous
      });
      return NextResponse.json(transaction);
    }
    
    // Directors - Update
    if (path.startsWith('/directors/')) {
      const id = path.split('/')[2];
      const body = await request.json();
      
      const updateData = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.email !== undefined) {
        // Check if email is already taken by another director
        const existingDirector = await db.collection('directors').findOne({ 
          email: body.email.toLowerCase(),
          id: { $ne: id }
        });
        if (existingDirector) {
          return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
        }
        updateData.email = body.email.toLowerCase();
      }
      updateData.updated_at = new Date();
      
      const result = await db.collection('directors').updateOne(
        { id },
        { $set: updateData }
      );
      
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Director not found' }, { status: 404 });
      }
      
      const director = await db.collection('directors').findOne({ id }, { projection: { password_hash: 0 } });
      return NextResponse.json(director);
    }
    
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const { pathname } = new URL(request.url);
  const path = pathname.replace('/api', '') || '/';
  
  try {
    const db = await getDb();
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    
    // Projects - Delete
    if (path.startsWith('/projects/')) {
      const id = path.split('/')[2];
      const result = await db.collection('projects').deleteOne({ id });
      
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      
      return NextResponse.json({ message: 'Project deleted' });
    }
    
    // Transactions - Delete
    if (path.startsWith('/transactions/')) {
      const id = path.split('/')[2];
      const existing = await db.collection('transactions').findOne({ id, is_deleted: { $ne: true } });
      if (!existing) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      await insertTransactionAudit(db, {
        action: 'delete',
        actorId: user.sub,
        transaction: existing
      });
      await db.collection('transactions').updateOne(
        { id },
        {
          $set: {
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: user.sub,
            updated_at: new Date(),
            updated_by: user.sub
          }
        }
      );
      return NextResponse.json({ message: 'Transaction deleted (soft)' });
    }
    
    // Directors - Delete
    if (path.startsWith('/directors/')) {
      const id = path.split('/')[2];
      
      // Prevent deleting yourself
      if (id === user.sub) {
        return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
      }
      
      const result = await db.collection('directors').deleteOne({ id });
      
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: 'Director not found' }, { status: 404 });
      }
      
      return NextResponse.json({ message: 'Director deleted' });
    }
    
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
