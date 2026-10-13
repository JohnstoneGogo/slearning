type LessonWithCourse = {
  course: {
    published: boolean;
  };
};

export function isLessonInPublishedCourse(lesson: LessonWithCourse): boolean {
  return lesson.course.published === true;
}
