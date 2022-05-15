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
}