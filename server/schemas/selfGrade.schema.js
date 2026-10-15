const { z } = require("../config/zod");
const { VERDICTS } = require("./graderOutput.schema");

// Body di POST /attempts/:id/self-grade: il verdetto che lei si dà
const selfGradeSchema = z.strictObject({
  verdict: z.enum(VERDICTS),
});

module.exports = { selfGradeSchema };
