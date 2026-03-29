import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, verifyPassword, createAccessToken, createRefreshToken, getUserFromRequest, verifyToken } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { calculateCompanyIncome, calculateCompanyBalance, calculateDirectorIncome, calculateDirectorBalance, getCurrentFinancialYear, getFinancialYearDates, getMonthDateRange } from '@/lib/financial';

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
    
    // Transactions - List
    if (path === '/transactions') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type');
      const directorId = searchParams.get('director_id');
      
      const query = {};
      if (type) query.transaction_type = type;
      if (directorId) query.director_id = directorId;
      
      const transactions = await db.collection('transactions').find(query).sort({ transaction_date: -1 }).toArray();
      return NextResponse.json(transactions);
    }
    
    // Transactions - Get by ID
    if (path.startsWith('/transactions/')) {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const id = path.split('/')[2];
      const transaction = await db.collection('transactions').findOne({ id });
      
      if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      
      return NextResponse.json(transaction);
    }
    
    // Directors - List
    if (path === '/directors') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const directors = await db.collection('directors').find({}).project({ password_hash: 0 }).toArray();
      return NextResponse.json(directors);
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
    
    // Dashboard - Company
    if (path === '/dashboard/company') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const { searchParams } = new URL(request.url);
      const period = searchParams.get('period') || 'all'; // month, year, all
      const month = searchParams.get('month'); // 0-11
      const year = searchParams.get('year');
      
      let query = {};
      
      if (period === 'month' && month && year) {
        const { startDate, endDate } = getMonthDateRange(parseInt(year), parseInt(month));
        query.transaction_date = { $gte: startDate, $lte: endDate };
      } else if (period === 'year' && year) {
        const { startDate, endDate } = getFinancialYearDates(parseInt(year));
        query.transaction_date = { $gte: startDate, $lte: endDate };
      }
      
      const transactions = await db.collection('transactions').find(query).toArray();
      
      const totalIncome = transactions
        .filter(t => t.transaction_type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const totalExpenses = transactions
        .filter(t => t.transaction_type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const companyIncome = calculateCompanyIncome(transactions);
      const companyBalance = calculateCompanyBalance(transactions);
      
      return NextResponse.json({
        totalIncome,
        totalExpenses,
        companyIncome,
        companyBalance,
        period,
        month,
        year
      });
    }
    
    // Dashboard - Director
    if (path === '/dashboard/director') {
      const user = await requireAuth(request);
      if (user instanceof NextResponse) return user;
      
      const { searchParams } = new URL(request.url);
      const directorId = searchParams.get('director_id') || user.sub;
      const period = searchParams.get('period') || 'all';
      const month = searchParams.get('month');
      const year = searchParams.get('year');
      
      let query = {};
      
      if (period === 'month' && month && year) {
        const { startDate, endDate } = getMonthDateRange(parseInt(year), parseInt(month));
        query.transaction_date = { $gte: startDate, $lte: endDate };
      } else if (period === 'year' && year) {
        const { startDate, endDate } = getFinancialYearDates(parseInt(year));
        query.transaction_date = { $gte: startDate, $lte: endDate };
      }
      
      const transactions = await db.collection('transactions').find(query).toArray();
      const totalDirectors = await db.collection('directors').countDocuments();
      
      const directorOwnIncome = transactions
        .filter(t => t.transaction_type === 'income' && t.account_type === 'director' && t.director_id === directorId)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const directorExpenses = transactions
        .filter(t => t.transaction_type === 'expense' && t.account_type === 'director' && t.director_id === directorId)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const loansGiven = transactions
        .filter(t => t.transaction_type === 'loan' && t.director_id === directorId)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const transfersOut = transactions
        .filter(t => t.transaction_type === 'transfer' && t.from_director_id === directorId)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const transfersIn = transactions
        .filter(t => t.transaction_type === 'transfer' && t.to_director_id === directorId)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const shareOfIncome = calculateDirectorIncome(directorId, transactions, totalDirectors);
      const balance = calculateDirectorBalance(directorId, transactions, totalDirectors);
      
      return NextResponse.json({
        directorId,
        directorOwnIncome,
        directorExpenses,
        loansGiven,
        transfersOut,
        transfersIn,
        shareOfIncome,
        balance,
        period,
        month,
        year
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
      
      // Create director
      const director = {
        id: uuidv4(),
        name,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        created_at: new Date()
      };
      
      await db.collection('directors').insertOne(director);
      
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
      const { transaction_type, amount, account_type, director_id, project_id, from_director_id, to_director_id, description, transaction_date } = body;
      
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
        transaction_date: transaction_date ? new Date(transaction_date) : new Date(),
        created_at: new Date(),
        created_by: user.sub
      };
      
      await db.collection('transactions').insertOne(transaction);
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
        created_at: new Date(),
        created_by: user.sub
      };
      
      await db.collection('directors').insertOne(director);
      
      // Remove password hash from response
      const { password_hash, ...directorData } = director;
      return NextResponse.json(directorData);
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
      
      const updateData = {};
      if (body.transaction_type !== undefined) updateData.transaction_type = body.transaction_type;
      if (body.amount !== undefined) updateData.amount = parseFloat(body.amount);
      if (body.account_type !== undefined) updateData.account_type = body.account_type;
      if (body.director_id !== undefined) updateData.director_id = body.director_id;
      if (body.project_id !== undefined) updateData.project_id = body.project_id;
      if (body.from_director_id !== undefined) updateData.from_director_id = body.from_director_id;
      if (body.to_director_id !== undefined) updateData.to_director_id = body.to_director_id;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.transaction_date !== undefined) updateData.transaction_date = new Date(body.transaction_date);
      updateData.updated_at = new Date();
      
      const result = await db.collection('transactions').updateOne(
        { id },
        { $set: updateData }
      );
      
      if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      
      const transaction = await db.collection('transactions').findOne({ id });
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
      const result = await db.collection('transactions').deleteOne({ id });
      
      if (result.deletedCount === 0) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      
      return NextResponse.json({ message: 'Transaction deleted' });
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
