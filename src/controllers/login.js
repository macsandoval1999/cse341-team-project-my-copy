import { getUserByEmail, getUserByUsername } from "../models/users.js";
import { hasRole, verifyPassword } from "../middleware/authentication.js";

const isApiRequest = (req) => req.path.startsWith('/api/');
const isRequestObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

const sendLoginError = (req, res, status, error) => {
    if (isApiRequest(req)) {
        return res.status(status).json({ error });
    }
    const identifier = req.body?.identifier ?? req.body?.email ?? req.body?.username ?? '';
    let oldIdentifier = '';
    if (typeof identifier === 'string') {
        oldIdentifier = identifier;
    }
    return res.status(status).render('login', {
        title: 'Login',
        loginError: error,
        oldIdentifier,
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

    const body = req.body;
    const identifierFields = ['identifier', 'email', 'username'].filter(
        (field) => body?.[field] !== undefined
    );
    const allowedFields = ['identifier', 'email', 'username', 'password'];
    const unknownFields = isRequestObject(body)
        ? Object.keys(body).filter((field) => !allowedFields.includes(field))
        : [];
    const invalidFields = isRequestObject(body)
        ? allowedFields.filter(
            (field) => body[field] !== undefined && typeof body[field] !== 'string'
        )
        : [];
    if (
        !isRequestObject(body) ||
        unknownFields.length > 0 ||
        invalidFields.length > 0 ||
        identifierFields.length !== 1
    ) {
        const errors = [];
        if (!isRequestObject(body)) {
            errors.push('Login data must be an object');
        }
        if (unknownFields.length > 0) {
            errors.push(`Unknown login fields: ${unknownFields.join(', ')}`);
        }
        if (invalidFields.length > 0) {
            errors.push(`Login fields must be strings: ${invalidFields.join(', ')}`);
        }
        if (identifierFields.length !== 1) {
            errors.push('Provide exactly one of identifier, email, or username');
        }
        return sendLoginError(req, res, 400, errors.join('. '));
    }

    const identifierValue = body[identifierFields[0]];
    let identifier = '';
    if (typeof identifierValue === 'string') {
        identifier = identifierValue.trim().toLowerCase();
    }
    let password = '';
    if (typeof body.password === 'string') {
        password = body.password;
    }
    if (!identifier || !password) {
        return sendLoginError(req, res, 400, 'Username/email and password are required');
    }

    try {
        let user;
        if (identifier.includes('@')) {
            user = await getUserByEmail(identifier);
        } else {
            user = await getUserByUsername(identifier);
        }
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

        if (hasRole(sessionUser, 'admin')) {
            return res.redirect('/admin');
        }
        return res.redirect('/dashboard');
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