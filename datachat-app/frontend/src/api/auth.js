import { api } from "./http";

// res.data : whatever JSON the server returns

//Helper: extract a message from axios errors
function getAxiosErrorMessage(err) {
    //Axios puts server responses in err.response
    // FastAPI often returns { detail: "..."}\
    return (
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Request failed"
    );
}

export async function register(email, password) {
    try {
        //Post to /auth/register with credentials
        //using the shared api instance keeps baseURL / credential settings centralized
        const res = await api.post("/auth/register", {email, password});
        return res.data; // access_token, token_type
    } catch (err) {
        throw new Error(getAxiosErrorMessage(err));
    }
}

export async function login(email, password) {
    try{
        const res = await api.post("/auth/login", {email, password});
        return res.data;
    } catch (err) {
        throw new Error(getAxiosErrorMessage(err));
    }
}

export async function refresh() {
    try {
        const res = await api.post("/auth/refresh");
        return res.data;
    } catch (err) {
        throw new Error(getAxiosErrorMessage(err));
    }
}

export async function logout() {
    try {
        const res = await api.post("/auth/logout");
        return res.data;
    } catch (err) {
        throw new Error(getAxiosErrorMessage(err));
    }
}

export async function me(accessToken) {
    try {
        const res = await api.get("/auth/me", {
            headers: {Authorization: "Bearer " + accessToken},
        });
        return res.data;
    } catch (err) {
        throw new Error(getAxiosErrorMessage);
    }
}

