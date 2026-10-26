const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const parsePositiveInteger = (value, fallback) => {
    if (value === undefined) {
        return fallback;
    }

    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
};

export const parseListQuery = (query, allowedSortFields, defaultSort) => {
    const page = parsePositiveInteger(query.page, 1);
    const limit = parsePositiveInteger(query.limit, DEFAULT_LIMIT);
    const errors = [];

    if (!page || !limit || limit > MAX_LIMIT) {
        errors.push({
            field: "pagination",
            message: `page and limit must be positive integers, and limit cannot exceed ${MAX_LIMIT}.`,
        });
    }

    let sort = query.sort;
    if (sort === undefined) {
        sort = defaultSort;
    }
    if (
        typeof sort !== "string" ||
        !allowedSortFields.includes(sort)
    ) {
        errors.push({
            field: "sort",
            message: `sort must be one of: ${allowedSortFields.join(", ")}.`,
        });
    }

    let requestedOrder = "asc";
    if (query.order !== undefined) {
        if (typeof query.order === "string") {
            requestedOrder = query.order.toLowerCase();
        } else {
            requestedOrder = "";
        }
    }
    if (!["asc", "desc"].includes(requestedOrder)) {
        errors.push({
            field: "order",
            message: "order must be asc or desc.",
        });
    }

    if (errors.length > 0) {
        return { errors };
    }

    let order = 1;
    if (requestedOrder === "desc") {
        order = -1;
    }

    return {
        page,
        limit,
        sort,
        order,
        orderName: requestedOrder,
        errors,
    };
};

export const createPagination = (page, limit, totalItems) => {
    const totalPages = Math.ceil(totalItems / limit);

    return {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1 && totalPages > 0,
    };
};

export const createListResponse = ({
    data,
    page,
    limit,
    totalItems,
    query = {},
    sort,
    order,
}) => {
    let orderName = "asc";
    if (order === -1) {
        orderName = "desc";
    }

    return {
        data,
        query,
        sort: { field: sort, order: orderName },
        pagination: createPagination(page, limit, totalItems),
    };
};

export const escapeRegExp = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const parseOptionalString = (value, field, { maxLength } = {}) => {
    if (value === undefined) {
        return { value: undefined };
    }

    if (typeof value !== "string") {
        return { error: `${field} must be a single string value.` };
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return { error: `${field} must not be empty.` };
    }
    if (maxLength && trimmed.length > maxLength) {
        return {
            error: `${field} must be between 1 and ${maxLength} characters.`,
        };
    }

    return { value: trimmed };
};

export const parseOptionalFilters = (query, filters) => {
    const values = {};
    const errors = [];

    for (const [field, options] of Object.entries(filters)) {
        const parsed = parseOptionalString(query[field], field, options);
        if (parsed.error) {
            errors.push({ field, message: parsed.error });
        }
        values[field] = parsed;
    }

    return { values, errors };
};
