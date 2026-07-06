import apiClient from '../api/apiClient';

export interface User {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
    phone?: string;
    salary?: string;
    tJM?: string;
    available: boolean;
    skills: string[];
    created_at: string;
}

export interface CreateUserPayload {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
    salary?: string;
    tJM?: string;
    skills?: string[];
}

export const getUsers = async (): Promise<User[]> => {
    const { data } = await apiClient.get<User[]>('/users');
    return data;
};

export const createUser = async (userData: CreateUserPayload): Promise<User> => {
    const { data } = await apiClient.post<User>('/users', userData);
    return data;
};
