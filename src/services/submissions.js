const SUBMISSIONS_COLLECTION = 'submissions'
export const SUBMISSION_STATUSES = ['unprocessed', 'scored']

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

export async function generateSubmissionId(db, date = new Date()) {
  const year = date.getUTCFullYear()
  const prefix = `SUB-${year}-`

  // Derived from the highest existing id in the year, not a count, so a gap
  // left by a deleted or hand-picked id (e.g. real intake's POST /submissions
  // accepts an arbitrary submissionId) can't produce a duplicate. Anchored to
  // exactly 4 digits so a longer suffix in some other id shape can't match.
  const highest = await db
    .collection(SUBMISSIONS_COLLECTION)
    .find({ submissionId: { $regex: `^${prefix}\\d{4}$` } })
    .sort({ submissionId: -1 })
    .limit(1)
    .toArray()

  const highestSequence = highest.length
    ? Number(highest[0].submissionId.slice(prefix.length))
    : 0
  const nextSequence = highestSequence + 1

  if (nextSequence > 9999) {
    throw new Error(`No SUB-${year}-NNNN ids left: sequence exhausted`)
  }

  return `${prefix}${nextSequence.toString().padStart(4, '0')}`
}
export async function markScored(db, submissionId, result) {
  await db.collection('submissions').updateOne(
    { submissionId },
    {
      $set: {
        status: 'scored',
        result,
        scoredAt: new Date()
      }
    }
  )
}
