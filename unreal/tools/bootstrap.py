"""Run inside Unreal Editor once to author native materials and the startup map."""
import unreal as u
L=u.MaterialEditingLibrary
u.EditorAssetLibrary.make_directory('/Game/Materials')
def material(name, kind):
    path='/Game/Materials/'+name
    m=u.load_asset(path) or u.AssetToolsHelpers.get_asset_tools().create_asset(name,'/Game/Materials',u.Material,u.MaterialFactoryNew())
    L.delete_all_material_expressions(m)
    m.set_editor_property('two_sided',True)
    if kind in ('transparent','particle','mark'): m.set_editor_property('blend_mode',u.BlendMode.BLEND_TRANSLUCENT)
    if kind!='surface': m.set_editor_property('shading_model',u.MaterialShadingModel.MSM_UNLIT)
    def expr(cls): return L.create_material_expression(m,getattr(u,'MaterialExpression'+cls))
    def scalar(name,value):
        e=expr('ScalarParameter');e.set_editor_property('parameter_name',name);e.set_editor_property('default_value',value);return e
    def vector(name,value):
        e=expr('VectorParameter');e.set_editor_property('parameter_name',name);e.set_editor_property('default_value',u.LinearColor(*value));return e
    def link(a,b,p='',out=''): assert L.connect_material_expressions(a,out,b,p), (a.get_name(),b.get_name(),p)
    def mul(a,b):
        e=expr('Multiply');link(a,e,'A');link(b,e,'B');return e
    tint=vector('Tint',(1,1,1,1));opacity=scalar('Opacity',1)
    if kind in ('particle','mark'):
        base=tint
        if kind=='particle':
            uv=expr('TextureCoordinate');center=vector('Center',(.5,.5,0,0));mask=expr('ComponentMask');mask.set_editor_property('r',True);mask.set_editor_property('g',True);link(center,mask)
            distance=expr('Distance');link(uv,distance,'A');link(mask,distance,'B');fall=expr('OneMinus');link(mul(distance,scalar('Radius',2)),fall);sat=expr('Saturate');link(fall,sat);opacity=mul(opacity,mul(sat,sat))
        L.connect_material_property(base,'',u.MaterialProperty.MP_EMISSIVE_COLOR);L.connect_material_property(opacity,'',u.MaterialProperty.MP_OPACITY)
    else:
        tex=expr('TextureSampleParameter2D');tex.set_editor_property('parameter_name','Albedo');tex.set_editor_property('texture',u.load_asset('/Engine/EngineResources/WhiteSquareTexture.WhiteSquareTexture'))
        uv=expr('TextureCoordinate');repeat=vector('Repeat',(1,1,0,0));mask=expr('ComponentMask');mask.set_editor_property('r',True);mask.set_editor_property('g',True);link(repeat,mask);link(mul(uv,mask),tex)
        use=scalar('UseTexture',0);lerp=expr('LinearInterpolate');link(tint,lerp,'A');link(mul(tint,tex),lerp,'B');link(use,lerp,'Alpha');vc=expr('VertexColor');base=mul(lerp,vc);glow=vector('Glow',(0,0,0,0))
        if kind=='surface':
            L.connect_material_property(base,'',u.MaterialProperty.MP_BASE_COLOR);L.connect_material_property(scalar('Metallic',0),'',u.MaterialProperty.MP_METALLIC);L.connect_material_property(scalar('Roughness',.5),'',u.MaterialProperty.MP_ROUGHNESS);L.connect_material_property(glow,'',u.MaterialProperty.MP_EMISSIVE_COLOR)
        else:
            add=expr('Add');link(base,add,'A');link(glow,add,'B');L.connect_material_property(add,'',u.MaterialProperty.MP_EMISSIVE_COLOR)
        if kind=='transparent':
            alpha=expr('LinearInterpolate');link(scalar('Opaque',1),alpha,'A');link(tex,alpha,'B','A');link(use,alpha,'Alpha');L.connect_material_property(mul(opacity,alpha),'',u.MaterialProperty.MP_OPACITY)
    L.recompile_material(m);u.EditorAssetLibrary.save_loaded_asset(m)
for name,kind in [('M_Surface','surface'),('M_Unlit','unlit'),('M_Transparent','transparent'),('M_Particle','particle'),('M_Mark','mark')]: material(name,kind)
u.EditorAssetLibrary.make_directory('/Game/Maps')
level=u.get_editor_subsystem(u.LevelEditorSubsystem)
if not u.EditorAssetLibrary.does_asset_exist('/Game/Maps/Covenant'): level.new_level('/Game/Maps/Covenant')
level.save_current_level()
u.log('WILDDRIFT_BOOTSTRAP_OK')
