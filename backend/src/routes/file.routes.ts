import { Router } from 'express';
import { authGuard } from '../middlewares/auth.middleware';
import * as fileController from '../controllers/file.controller';

const router = Router();

// All routes are protected
router.use(authGuard);

router.post('/upload-url', (req, res) => {
    fileController.getUploadUrl(req, res);
});
router.get('/download-url/:fileId', (req, res) => {
    fileController.getDownloadUrl(req, res);
});
router.put('/:fileId/metadata', (req, res) => {
    fileController.updateFileMetadata(req, res);
});

export default router; 