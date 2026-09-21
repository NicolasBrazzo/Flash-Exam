const supabase = require("../config/db_connection");

const TABLE_NAME = "FE_Users";

// find user by email
const findUserByEmail = async (email) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .eq("email", email)
    .maybeSingle();   // .single genera un errore se non trova righe!

  if (error) {
    throw new Error("DATABASE_FIND_USER_ERROR");
  }

  return data;
};

module.exports = {
  findUserByEmail,
};
