import { Request, Response } from 'express';
import prisma from '../../config/database';
import { successResponse } from '../../utils/response';

// Get active social links for frontend
export const getAllActiveSocialLinks = async (_req: Request, res: Response) => {
    try {
        const socialLinks = await prisma.socialMedia.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        res.status(200).json(successResponse(socialLinks, 'Redes sociales obtenidas'));
    } catch (error) {
        console.error('Error fetching active social links:', error);
        res.status(500).json({ message: 'Error al obtener redes sociales' });
    }
};

// Admin: Get all social links
export const getAllSocialLinks = async (_req: Request, res: Response) => {
    try {
        const socialLinks = await prisma.socialMedia.findMany({
            orderBy: { created_at: 'desc' }
        });
        res.status(200).json(successResponse(socialLinks, 'Todas las redes sociales obtenidas'));
    } catch (error) {
        console.error('Error fetching all social links:', error);
        res.status(500).json({ message: 'Error al obtener redes sociales' });
    }
};

// Admin: Create new social link
export const createSocialLink = async (req: Request, res: Response) => {
    try {
        const { name, url, label, isActive } = req.body;

        if (!name || !url || !label) {
            return res.status(400).json({ message: 'Nombre, URL y Etiqueta son requeridos' });
        }

        const newLink = await prisma.socialMedia.create({
            data: { name, url, label, isActive: isActive ?? true }
        });

        res.status(201).json(successResponse(newLink, 'Red social creada exitosamente'));
    } catch (error) {
        console.error('Error creating social link:', error);
        res.status(500).json({ message: 'Error al crear red social' });
    }
};

// Admin: Update social link
export const updateSocialLink = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, url, label, isActive } = req.body;

        const updatedLink = await prisma.socialMedia.update({
            where: { id },
            data: { name, url, label, isActive }
        });

        res.status(200).json(successResponse(updatedLink, 'Red social actualizada exitosamente'));
    } catch (error) {
        console.error('Error updating social link:', error);
        res.status(500).json({ message: 'Error al actualizar red social' });
    }
};

// Admin: Delete social link
export const deleteSocialLink = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.socialMedia.delete({
            where: { id }
        });
        res.status(200).json(successResponse(null, 'Red social eliminada exitosamente'));
    } catch (error) {
        console.error('Error deleting social link:', error);
        res.status(500).json({ message: 'Error al eliminar red social' });
    }
};
