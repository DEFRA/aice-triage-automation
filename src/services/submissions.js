const SUBMISSIONS_COLLECTION = 'submissions'

export const SUBMISSION_STATUSES = ['unprocessed']

export async function insertSubmission(
  db,
  { submissionId, text, submittedAt }
) {
  return db.collection(SUBMISSIONS_COLLECTION).updateOne(
    { submissionId },
    {
      $setOnInsert: {
        submissionId,
        text,
        submittedAt,
        receivedAt: new Date(),
        status: 'unprocessed'
      }
    },
    { upsert: true }
  )
}

export function findSubmissions(db, { status }) {
  return db
    .collection(SUBMISSIONS_COLLECTION)
    .find({ status }, { projection: { _id: 0 } })
    .sort({ receivedAt: -1 })
    .toArray()
}

export function findSubmission(db, submissionId) {
  return db
    .collection(SUBMISSIONS_COLLECTION)
    .findOne({ submissionId }, { projection: { _id: 0 } })
}
