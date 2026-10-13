-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "priceGhs" INTEGER,
ADD COLUMN     "priceNgn" INTEGER;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "courseId" INTEGER,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'activation';

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
