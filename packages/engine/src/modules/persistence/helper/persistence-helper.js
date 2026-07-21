import mongoose from "mongoose";


export class PersistenceHelper {

    /**
     *
     * @param tableName
     * @param condition
     * @returns {object}
     */
    static async findRecord(tableName, condition) {
        return await mongoose.connection.collection(tableName).findOne(condition || {})
    }

    /**
     *
     * @param tableName
     * @param condition
     * @returns {object}
     */
    static async findRecords(tableName, condition) {
        return await mongoose.connection.collection(tableName).find(condition || {}).toArray()
    }



}