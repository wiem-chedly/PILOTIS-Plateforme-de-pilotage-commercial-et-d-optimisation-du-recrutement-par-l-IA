from app.extensions import db
from datetime import datetime

class JobRequisition(db.Model):
    __tablename__ = 'job_requisitions'
    
    requisition_id = db.Column(db.Integer, primary_key=True)
    boond_id = db.Column(db.String(100), unique=True)  
    reference = db.Column(db.String(50))  
    date = db.Column(db.String(20))
    titre = db.Column(db.String(200))
    type_offre = db.Column(db.String(50))
    client_nom = db.Column(db.String(200))
    contact_nom = db.Column(db.String(200))
    statut = db.Column(db.String(50))
    progression = db.Column(db.String(20))
    etat_complet = db.Column(db.String(100))
    manager_nom = db.Column(db.String(200))
    agence_nom = db.Column(db.String(200))
    devise = db.Column(db.String(50))
    budget_ht = db.Column(db.Float, default=0)
    ca_pondere = db.Column(db.Float, default=0)
    duree = db.Column(db.String(50))
    date_demarrage = db.Column(db.String(50))
    pos_actif = db.Column(db.Integer, default=0)
    description = db.Column(db.Text, nullable=True)   
    criteres = db.Column(db.Text, nullable=True)      
    date_import = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f"<Job {self.reference} - {self.titre}>"

class ImportLog(db.Model):
    __tablename__ = 'import_logs'
    
    id_logs = db.Column(db.Integer, primary_key=True)
    date_import = db.Column(db.DateTime, default=datetime.utcnow)
    statut = db.Column(db.String(20))
    message = db.Column(db.Text)
    nombre_importes = db.Column(db.Integer, default=0)