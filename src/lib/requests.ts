import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { getDb } from './firebase';
import { route, type Category, type Priority } from './routing';

export const STATUSES = ['open', 'in_progress', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  open: '受付済み',
  in_progress: '対応中',
  done: '完了',
};

export interface RequestDoc {
  id: string;
  title: string;
  body: string;
  category: Category;
  assignee: string;
  priority: Priority;
  matched: string[];
  status: Status;
  createdBy: string;
  createdByName: string | null;
  createdAt: Timestamp | null;
}

const COLLECTION = 'requests';

/** 依頼を作成する。カテゴリ・担当者・優先度は保存時に自動で決まる */
export async function createRequest(params: {
  title: string;
  body: string;
  uid: string;
  displayName: string | null;
}) {
  const { title, body, uid, displayName } = params;
  const routed = route(title, body);

  await addDoc(collection(getDb(), COLLECTION), {
    title,
    body,
    category: routed.category,
    assignee: routed.assignee,
    priority: routed.priority,
    matched: routed.matched,
    status: 'open' satisfies Status,
    createdBy: uid,
    createdByName: displayName,
    createdAt: serverTimestamp(),
  });
}

export async function updateStatus(id: string, status: Status) {
  await updateDoc(doc(getDb(), COLLECTION, id), { status });
}

/** 依頼一覧を購読する。Firestore の onSnapshot で変更が即座に反映される */
export function subscribeRequests(
  onChange: (items: RequestDoc[]) => void,
  onError: (e: Error) => void
) {
  const q = query(collection(getDb(), COLLECTION), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestDoc, 'id'>) }))
      );
    },
    (e) => onError(e as Error)
  );
}
