import { getUserByEmail, getUserByUsername } from "../models/users.js";
import { hasRole, verifyPassword } from "../middleware/authentication.js";

const isApiRequest = (req) => req.path.startsWith('/api/');

const sendLoginError = (req, res, status, error) => {
    if (isApiRequest(req)) {
        return res.status(status).json({ error });
    }
    const identifier = req.body?.identifier ?? req.body?.email ?? req.body?.username ?? '';
    return res.status(status).render('login', {
        title: 'Login',
        loginError: error,
        oldIdentifier: typeof identifier === 'string' ? identifier : '',
    });
};

export async function login(req, res) {
    if (req.session?.user) {
        const error = 'You are already logged in. Log out before trying to log in again.';
        if (isApiRequest(req)) {
            return res.status(409).json({ error });
        }
        return res.status(409).render('login', {
            title: 'Login',
            loginError: error,
            oldIdentifier: req.body?.identifier ?? req.body?.email ?? req.body?.username ?? '',
        });
    }

    const identifierValue = req.body?.identifier ?? req.body?.email ?? req.body?.username;
    const identifier = typeof identifierValue === 'string' ? identifierValue.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!identifier || !password) {
        return sendLoginError(req, res, 400, 'Username/email and password are required');
    }

    try {
        const user = identifier.includes('@')
            ? await getUserByEmail(identifier)
            : await getUserByUsername(identifier);
        const isPasswordValid = user && await verifyPassword(password, user.passwordHash);
        if (!isPasswordValid) {
            return sendLoginError(req, res, 401, 'Invalid email or password');
        }

        const userId = user._id.toString();
        const sessionUser = {
            _id: userId,
            name: user.name,
            email: user.email,
            role: { name: user.role?.name ?? null },
        };
        req.session.user = sessionUser;

        if (isApiRequest(req)) {
            return res.status(200).json({
                message: 'User logged in successfully',
                user: sessionUser,
            });
        }

        return res.redirect(hasRole(sessionUser, 'admin') ? '/admin' : '/dashboard');
    } catch (error) {
        console.error('Error during login:', error);
        return sendLoginError(req, res, 500, 'An error occurred during login. Please try again.');
    }
}

export async function logout(req, res) {
    const apiRequest = isApiRequest(req);
    if (!req.session?.user) {
        if (apiRequest) {
            return res.status(401).json({ error: 'No user is currently logged in' });
        }
        return res.redirect('/login');
    }

    return new Promise((resolve) => {
        req.session.destroy((error) => {
            if (error) {
                console.error('Error during logout:', error);
                if (apiRequest) {
                    return resolve(res.status(500).json({ error: 'An error occurred during logout' }));
                }
                return resolve(res.redirect('/login'));
            }

            res.clearCookie('connect.sid');
            if (apiRequest) {
                return resolve(res.status(200).json({ message: 'Logout successful' }));
            }
            return resolve(res.redirect('/login'));
        });
    });
}