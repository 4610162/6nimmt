"use client";

import { motion, AnimatePresence } from "framer-motion";

interface RulebookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
  exit: { opacity: 0 },
};

const item = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0 },
};

export function RulebookModal({ isOpen, onClose }: RulebookModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-slate-800 border border-slate-600 shadow-2xl overflow-hidden dark:bg-slate-800 dark:border-slate-600"
          >
            {/* 헤더 */}
            <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-600 bg-slate-800/80">
              <motion.h2
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="text-xl font-bold text-amber-400"
              >
                6 nimmt! 규칙서
              </motion.h2>
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>

            {/* 스크롤 본문 */}
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-slate-300"
            >
              <motion.section variants={item} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">카드</h3>
                <p className="text-sm leading-relaxed">
                  <strong className="text-slate-200">1~104번</strong> 번호가 적힌 카드가 있습니다. 각 카드에는
                  <strong className="text-slate-200"> 벌점(황소 머리)</strong>이 있습니다: 55번 = 7점, 11의 배수 = 5점,
                  10의 배수 = 3점, 5의 배수 = 2점, 그 외 = 1점.
                </p>
              </motion.section>

              <motion.section variants={item} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400">테이블과 오름차순 배치</h3>
                <p className="text-sm leading-relaxed">
                  테이블에는 <strong className="text-slate-200">4개의 행</strong>이 있습니다. 각 행의 카드는
                  <strong className="text-slate-200"> 항상 오름차순</strong>으로 쌓입니다. 매 턴, 모든 플레이어가 카드
                  한 장을 동시에 선택한 뒤 공개합니다.
                </p>
              </motion.section>

              <motion.section variants={item} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-400">카드 놓기 규칙</h3>
                <ul className="text-sm leading-relaxed space-y-1 list-disc list-inside text-slate-300">
                  <li>
                    <strong className="text-slate-200">가장 낮은 카드</strong>를 낸 사람부터 순서대로 배치합니다.
                  </li>
                  <li>
                    새 카드는 <strong className="text-slate-200">해당 행의 마지막 카드보다 크면서, 차이가 가장 작은
                    행</strong>에 놓습니다.
                  </li>
                  <li>
                    자신의 카드가 <strong className="text-slate-200">모든 행의 마지막 카드보다 작으면</strong>, 그때는
                    네 행 중 <strong className="text-slate-200">어느 행을 가져갈지 직접 선택</strong>해야 합니다 (그 행의
                    카드 전부가 벌점으로 들어옵니다).
                  </li>
                </ul>
              </motion.section>

              <motion.section variants={item} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-400">6번째 카드 = 벌점</h3>
                <p className="text-sm leading-relaxed">
                  어떤 행에 카드가 <strong className="text-slate-200">이미 5장</strong> 있고, 새 카드를 그 행에 놓으면
                  <strong className="text-rose-300"> 6번째 카드</strong>가 됩니다. 이 경우 그 행에 있던
                  <strong className="text-slate-200"> 5장을 전부 가져가서 벌점</strong>으로 쌓고, 낸 카드 한 장만 그
                  행의 새 시작으로 둡니다.
                </p>
              </motion.section>

              <motion.section variants={item} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">승패</h3>
                <p className="text-sm leading-relaxed">
                  라운드는 <strong className="text-slate-200">10턴</strong>입니다. 여러 라운드를 하다가,
                  <strong className="text-rose-300"> 누군가 벌점이 66점 이상</strong>이 되면 게임이 끝납니다. 그때
                  <strong className="text-slate-200"> 벌점이 가장 적은 사람이 승자</strong>입니다.
                </p>
              </motion.section>
            </motion.div>

            {/* 푸터 */}
            <div className="shrink-0 px-6 py-4 border-t border-slate-600 bg-slate-800/50">
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                onClick={onClose}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
              >
                닫기
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
