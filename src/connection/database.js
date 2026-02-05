// supabase.js
// Read-only Supabase database class for public cats catalog
// Uses anon key with RLS - only SELECT access to cats (admin_notes hidden)

// ─── Configuration ───────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://xvlilgsawbqpedmrbdkv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2bGlsZ3Nhd2JxcGVkbXJiZGt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgxMjExMDYsImV4cCI6MjA4MzY5NzEwNn0.6_k63XlmfDIJ2jN0txMjcY-SKwYH7H_HF4b-3NrDKbA';

// ─── Database Class (Read-Only) ──────────────────────────────────────────────

export default class Database {
    
    constructor(tableName) {
        if (!tableName) {
            throw new Error('Table name is required');
        }
        
        this.tableName = tableName;
        this.baseUrl = `${SUPABASE_URL}/rest/v1`;
        this.headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * SELECT * FROM table
     * @returns {Promise<Array>} Array of row objects
     */
    async selectAll() {
        const response = await fetch(`${this.baseUrl}/${this.tableName}?select=*`, {
            method: 'GET',
            headers: this.headers
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch records');
        }
        
        return await response.json();
    }

    /**
     * SELECT * FROM table WHERE column = value
     * @param {Object} filters - Map of column names and their values for WHERE clause
     * @returns {Promise<Array>} Array of matching row objects
     */
    async select(filters = {}) {
        if (!filters || Object.keys(filters).length === 0) {
            return this.selectAll();
        }

        // Build query string with filters
        const queryParams = Object.entries(filters)
            .map(([col, val]) => `${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`)
            .join('&');

        const response = await fetch(`${this.baseUrl}/${this.tableName}?select=*&${queryParams}`, {
            method: 'GET',
            headers: this.headers
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch records');
        }
        
        return await response.json();
    }

    /**
     * Get all unique categories from the cats table
     * Dynamically extracts categories from the categories array column
     * @returns {Promise<Array<string>>} Array of unique category names
     */
    async getUniqueCategories() {
        // Use PostgREST to get all cats with categories
        const response = await fetch(`${this.baseUrl}/${this.tableName}?select=categories`, {
            method: 'GET',
            headers: this.headers
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch categories');
        }
        
        const cats = await response.json();
        
        // Extract and flatten all categories, then get unique values
        const allCategories = cats
            .filter(c => c.categories && Array.isArray(c.categories))
            .flatMap(c => c.categories);
        
        return [...new Set(allCategories)].sort();
    }

    /**
     * Filter cats by category
     * @param {string} category - Category name to filter by
     * @returns {Promise<Array>} Array of cats containing this category
     */
    async selectByCategory(category) {
        // Use PostgreSQL array contains operator @> 
        const response = await fetch(
            `${this.baseUrl}/${this.tableName}?select=*&categories=cs.{${encodeURIComponent(category)}}`,
            {
                method: 'GET',
                headers: this.headers
            }
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch cats by category');
        }
        
        return await response.json();
    }

    /**
     * Filter cats by multiple categories (AND logic)
     * @param {Array<string>} categories - Array of category names
     * @returns {Promise<Array>} Array of cats containing ALL these categories
     */
    async selectByCategories(categories) {
        if (!categories || categories.length === 0) {
            return this.selectAll();
        }
        
        // Use PostgreSQL array contains operator @> for AND logic
        const categoryArray = JSON.stringify(categories);
        const response = await fetch(
            `${this.baseUrl}/${this.tableName}?select=*&categories=cs.${encodeURIComponent(categoryArray)}`,
            {
                method: 'GET',
                headers: this.headers
            }
        );
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch cats by categories');
        }
        
        return await response.json();
    }
}